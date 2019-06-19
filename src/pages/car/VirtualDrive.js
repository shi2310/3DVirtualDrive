import Stats from 'stats-js';
import _ from 'lodash';
import Orbitcontrols from 'three-orbitcontrols';
import Car from './CarFun.js';
var THREE = (window.THREE = require('three'));
require('three/examples/js/loaders/GLTFLoader');
require('three/examples/js/loaders/DRACOLoader');
require('three/examples/js/pmrem/PMREMGenerator');
require('three/examples/js/pmrem/PMREMCubeUVPacker');

require('three/examples/js/lines/LineSegmentsGeometry.js');
require('three/examples/js/lines/LineGeometry.js');
require('three/examples/js/lines/LineMaterial.js');
require('three/examples/js/lines/LineSegments2.js');
require('three/examples/js/lines/Line2.js');

Car(THREE);

export class VirtualDrive {
  constructor(container, data, callback) {
    (async () => {
      await this.init(container, data);
      callback();
    })();
  }

  //时钟记时，刷新的间隔
  clock = new THREE.Clock();
  //汽车封装函数
  car = new THREE.Car();
  //相机目标定位
  cameraTarget = new THREE.Vector3();
  //每帧刷新时是否跟随相机
  followCamera = false;
  //相机
  camera;
  //场景
  scene;
  //地图2维宽高
  mapWH;
  //字体
  textFont;
  //状态器
  stats;
  //车3D对象
  carModel;
  //设置环境贴图
  envMap;
  //车部件
  carParts = {
    body: [],
    rims: [],
    glass: [],
  };

  //某帧路径规划
  pathRoutingLine;
  //某帧物体集合
  objects = [];
  //某帧球体集合
  balls = [];
  //某帧文本集合
  texts = [];

  //已经驶过的轨迹
  drivePath = null;
  drivePathPoint = [];

  async init(container, data) {
    const conWidth = container.clientWidth;
    const conHeight = container.clientHeight;
    const { width: map_width, length: map_height, granularity: map_size } = data.map;

    this.mapWH = { map_width, map_height };
    //状态器
    this.stats = new Stats();
    container.appendChild(this.stats.dom);
    //渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(conWidth, conHeight);
    renderer.gammaOutput = true;
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);

    //相机
    this.camera = new THREE.PerspectiveCamera(75, conWidth / conHeight, 1, 10000);
    this.camera.position.set(0, 70, 50);

    //角度控制
    this.orbitControls = new Orbitcontrols(this.camera, renderer.domElement);
    this.orbitControls.target = new THREE.Vector3(0, 0, 0); //控制焦点
    this.orbitControls.autoRotate = false;
    this.orbitControls.zoomSpeed = 10;
    //上下翻转的最大仰视角和俯视角。范围0-Math.PI 弧度，一个pi代表180°
    this.orbitControls.minPolarAngle = 0;
    this.orbitControls.maxPolarAngle = 1.5;

    //场景
    this.scene = new THREE.Scene();
    // this.scene.fog = new THREE.Fog(0xd7cbb1, 5, 80);

    //地面
    const ground = new THREE.Mesh(
      new THREE.PlaneBufferGeometry(
        this.mapWH.map_width,
        this.mapWH.map_height,
        map_size,
        map_size,
      ),
      new THREE.MeshBasicMaterial({ color: 0xbbbbbb, opacity: 1, transparent: true }),
    );
    ground.position.set(0, -1, 0);
    ground.rotation.x = -Math.PI / 2; //将平面沿着x轴进行旋转
    this.scene.add(ground);

    //网格--只能设置size为正方形
    // var grid = new THREE.GridHelper(this.mapWH.map_width, map_size);
    // grid.material.opacity = 0.2;
    // grid.material.depthWrite = false;
    // grid.material.transparent = true;
    // this.scene.add(grid);

    // 新建坐标轴
    var axis = new THREE.AxesHelper(100);
    // 在场景中添加坐标轴
    this.scene.add(axis);

    //字体加载
    await this.loadFont();

    //立方体纹理（天空盒）
    await this.loadCubeTexture(renderer);

    //载入汽车3D模型及材质
    await this.load3dObj(data.start_area);

    //加载地图
    this.loadObstacles(data.obstacles);

    //渲染器自动渲染，每个可用帧都会调用的函数
    renderer.setAnimationLoop(() => {
      this.renderCar();
      renderer.render(this.scene, this.camera);
    });
  }

  //加载字体
  loadFont() {
    return new Promise((resolve, reject) => {
      new THREE.FontLoader().load(
        'examples/fonts/optimer_bold.typeface.json',
        font => {
          this.textFont = font;
          resolve();
        },
        null,
        err => {
          reject(err);
        },
      );
    });
  }

  //加载立方体纹理（天空盒）
  loadCubeTexture(renderer) {
    return new Promise((resolve, reject) => {
      const urls = [
        require('assets/skyboxsun25deg/px.jpg'),
        require('assets/skyboxsun25deg/nx.jpg'),
        require('assets/skyboxsun25deg/py.jpg'),
        require('assets/skyboxsun25deg/ny.jpg'),
        require('assets/skyboxsun25deg/pz.jpg'),
        require('assets/skyboxsun25deg/nz.jpg'),
      ];
      //立方体纹理（天空盒）
      new THREE.CubeTextureLoader().load(
        urls,
        texture => {
          this.scene.background = texture;
          const pmremGenerator = new THREE.PMREMGenerator(texture);
          pmremGenerator.update(renderer);
          const pmremCubeUVPacker = new THREE.PMREMCubeUVPacker(pmremGenerator.cubeLods);
          pmremCubeUVPacker.update(renderer);
          //质感
          this.envMap = pmremCubeUVPacker.CubeUVRenderTarget.texture;
          pmremGenerator.dispose();
          pmremCubeUVPacker.dispose();

          resolve();
        },
        null,
        err => {
          reject(err);
        },
      );
    });
  }

  //加载3D模型
  load3dObj(startArea) {
    return new Promise((resolve, reject) => {
      THREE.DRACOLoader.setDecoderPath('examples/js/libs/draco/gltf/');
      const loader = new THREE.GLTFLoader();
      loader.setDRACOLoader(new THREE.DRACOLoader());
      THREE.DRACOLoader.getDecoderModule();
      loader.load(
        require('assets/ferrari.glb'),
        gltf => {
          this.carModel = gltf.scene.children[0];
          const xy = this.translateVector(startArea.nodes[0]);

          this.car.setModel(this.carModel, startArea.direction + 0.5, xy.x, xy.y);
          this.carModel.traverse(child => {
            if (child.isMesh) {
              child.material.envMap = this.envMap;
            }
          });
          // 阴影
          var texture = new THREE.TextureLoader().load(require('assets/ferrari_ao.png'));
          var shadow = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(0.655 * 4, 1.3 * 4).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: texture, opacity: 0.8, transparent: true }),
          );
          shadow.renderOrder = 2;
          this.carModel.add(shadow);
          this.scene.add(this.carModel);

          // 汽车部件对于原料选用
          this.carParts.body.push(this.carModel.getObjectByName('body'));
          this.carParts.rims.push(
            this.carModel.getObjectByName('rim_fl'),
            this.carModel.getObjectByName('rim_fr'),
            this.carModel.getObjectByName('rim_rr'),
            this.carModel.getObjectByName('rim_rl'),
            this.carModel.getObjectByName('trim'),
          );
          this.carParts.glass.push(this.carModel.getObjectByName('glass'));
          this.initCarMaterials();
          resolve();
        },
        null,
        error => {
          reject(error);
        },
      );
    });
  }

  //初始化汽车材料
  initCarMaterials() {
    var bodyMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      envMap: this.envMap,
      metalness: 0.9, //金属性贴图
      roughness: 0.5, //粗糙
      name: 'black',
    });
    var rimMat = new THREE.MeshStandardMaterial({
      color: 0x555555,
      envMap: this.envMap,
      envMapIntensity: 2.0,
      metalness: 1.0,
      roughness: 0.2,
      name: 'metallic',
    });
    var glassMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      envMap: this.envMap,
      metalness: 1,
      roughness: 0,
      opacity: 0.2,
      transparent: true,
      premultipliedAlpha: true,
      name: 'clear',
    });
    this.carParts.body.forEach(function(part) {
      part.material = bodyMat;
    });
    this.carParts.rims.forEach(function(part) {
      part.material = rimMat;
    });
    this.carParts.glass.forEach(function(part) {
      part.material = glassMat;
    });
  }

  //加载地图
  loadObstacles(obstacles) {
    const color = 0x0dc3b4;
    if (obstacles) {
      const material = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.5,
        transparent: true,
      });
      let mesh = null;
      _.each(obstacles, obj => {
        const xy = this.translateVector(obj.coordinate);
        if (mesh) {
          mesh = mesh.clone();
          mesh.geometry = new THREE.BoxGeometry(
            obj.dimension.width,
            obj.dimension.height + 2,
            obj.dimension.length,
          );
        } else {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(
              obj.dimension.width,
              obj.dimension.height + 2,
              obj.dimension.length,
            ),
            material,
          );
        }

        //物体沿中心扩展x，所以X轴偏移要加上width一半
        const x = xy.x + obj.dimension.width / 2;
        //物体沿中心扩展y，所以y轴偏移要加上height一半
        const z = xy.y + obj.dimension.length / 2;

        mesh.position.set(x, obj.dimension.height / 2, z);
        this.scene.add(mesh);

        let border = new THREE.BoxHelper(mesh, color);
        this.scene.add(border);
      });
    }
  }

  //某帧汽车数据的加载
  carFrame(carOrientation, position, routingArray, objectArray) {
    const xy = this.translateVector(position);
    //汽车位置，方向变化
    this.car.setChange(carOrientation, xy);
    if (this.followCamera) {
      const x = this.carModel.position.x + 10 * Math.sin(carOrientation);
      const z = this.carModel.position.z + 10 * Math.cos(carOrientation);
      this.camera.position.set(x, this.carModel.position.y + 10, z);
      this.camera.lookAt(
        this.carModel.position.x,
        this.carModel.position.y,
        this.carModel.position.z,
      );
    }

    //已行驶路径
    if (this.drivePath) {
      if (this.drivePath.isLine2) {
        this.drivePath.geometry.dispose();
        this.drivePath.material.dispose();
      }
      this.scene.remove(this.drivePath);
    }
    this.drivePathPoint.push(xy.x, -0.3, xy.y);
    this.refreshDrivePath(this.drivePathPoint, 0x9a32cd);

    //路径规划
    if (this.pathRoutingLine) {
      this.scene.remove(this.pathRoutingLine);
    }
    this.refreshRouting(routingArray);

    //障碍物
    if (this.objects) {
      _.each(this.objects, obj => {
        if (obj.isMesh) {
          obj.geometry.dispose(); //删除几何体
          obj.material.dispose(); //删除材质
        }
        //删除BoxHelper
        if (obj.isLineSegments) {
          obj.geometry.dispose(); //删除几何体
          obj.material.dispose(); //删除材质
        }
        this.scene.remove(obj);
      });
    }
    this.refreshObject(objectArray, 0xb0e2ff);
  }

  //-------路线材料，避免多次实例化--------
  lineMaterial = new THREE.LineMaterial({
    color: 0xc1ffc1,
    linewidth: 0.005, // in pixels
    opacity: 0.5,
  });

  //刷新已行驶过的路径
  refreshDrivePath(drivePathPoint, color) {
    let geometry = new THREE.LineGeometry();
    geometry.setPositions(drivePathPoint);
    const meterial = this.lineMaterial.clone();
    if (color) {
      meterial.setValues({ color });
    }
    this.drivePath = new THREE.Line2(geometry, meterial);
    this.scene.add(this.drivePath);
  }

  //刷新某帧路径规划
  refreshRouting(routingArray, color) {
    if (!_.isEmpty(routingArray)) {
      const arr = [];
      _.each(routingArray, xyz => {
        const xy = this.translateVector({ x: xyz.x, y: xyz.z });
        arr.push(xy.x, xyz.y, xy.y);
      });

      if (!this.pathRoutingLine) {
        const meterial = this.lineMaterial.clone();
        if (color) {
          meterial.setValues({ color });
        }
        this.pathRoutingLine = new THREE.Line2(new THREE.LineGeometry(), meterial);
      }
      this.pathRoutingLine.geometry.setPositions(arr);
      this.scene.add(this.pathRoutingLine);
    }
  }

  //刷新某帧物体
  refreshObject(objectArray, color) {
    if (!_.isEmpty(objectArray)) {
      let mesh = null;
      let material = new THREE.MeshBasicMaterial({ color, opacity: 0.8, transparent: true });
      _.each(objectArray, object => {
        let geometry = new THREE.BoxGeometry(object.width, object.height, object.length);
        if (mesh) {
          mesh = mesh.clone();
          mesh.geometry = geometry;
        } else {
          mesh = new THREE.Mesh(geometry, material);
        }
        const xy = this.translateVector({ x: object.x, y: object.z });
        mesh.position.set(xy.x, object.y + object.height / 2, xy.y);
        this.objects.push(mesh);
        this.scene.add(mesh);

        const border = new THREE.BoxHelper(mesh, color);
        this.objects.push(border);
        this.scene.add(border);
      });
    }
  }

  //刷新某帧球体
  refreshBalls(ballArray, color) {
    if (this.balls) {
      _.each(this.balls, ball => {
        this.scene.remove(ball);
        ball.remove();
      });
    }
    if (!_.isEmpty(ballArray)) {
      _.each(ballArray, object => {
        var mesh = new THREE.Mesh(
          new THREE.SphereGeometry(object.radius, 32, 32),
          new THREE.MeshBasicMaterial({ color: color }),
        );
        mesh.position.set(object.x, object.y + object.radius, object.z);
        this.balls.push(mesh);
        this.scene.add(mesh);
      });
    }
  }

  //刷新某帧文本
  refreshText(textArray, color) {
    if (this.texts) {
      _.each(this.texts, txt => {
        this.scene.remove(txt);
        txt.remove();
      });
    }
    if (!_.isEmpty(textArray) && this.textFont) {
      _.each(textArray, object => {
        var gem = new THREE.TextGeometry(object.txt, {
          size: 1,
          height: 0.2,
          font: this.textFont,
        });
        gem.center();
        var mat = new THREE.MeshBasicMaterial({
          color: 0x000000 || color,
        });
        var mesh = new THREE.Mesh(gem, mat);
        mesh.position.set(object.x, object.y + 0.5, object.z);
        this.balls.push(mesh);
        this.scene.add(mesh);
      });
    }
  }

  //自动渲染大概60/s的刷新率
  renderCar() {
    this.stats.update();
  }

  //转换地图中心原点为左上角原点坐标
  translateVector(point) {
    let xy = new THREE.Vector2();
    xy.x = point.x - this.mapWH.map_width / 2;
    xy.y = point.y - this.mapWH.map_height / 2;
    return xy;
  }
}

export default VirtualDrive;
