import Stats from 'stats-js';
import _ from 'lodash';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import Car from './CarFun.js';
var THREE = (window.THREE = require('three'));
require('three/examples/js/loaders/GLTFLoader');
require('three/examples/js/loaders/DRACOLoader');
require('three/examples/js/pmrem/PMREMGenerator');
require('three/examples/js/pmrem/PMREMCubeUVPacker');

require('three/examples/js/lines/LineSegmentsGeometry');
require('three/examples/js/lines/LineGeometry');
require('three/examples/js/lines/LineMaterial');
require('three/examples/js/lines/LineSegments2');
require('three/examples/js/lines/Line2');

Car(THREE);

export class VirtualDrive {
  constructor(container, data, callback) {
    (async () => {
      await this.init(container, data);
      callback();
    })();
  }

  //汽车封装函数
  car = new THREE.Car();
  //每帧刷新时是否跟随相机
  followCamera = false;
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

  //相机控制的旋转弧度
  azimuthalAngle = 0; //水平旋转弧度
  polarAngle = 0; //垂直旋转弧度

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
    renderer.sortObjects = true;
    container.appendChild(renderer.domElement);

    //相机
    const camera = new THREE.PerspectiveCamera(75, conWidth / conHeight, 1, 10000);
    camera.position.set(0, 70, 50);

    //角度控制
    this.orbitControls = new OrbitControls(camera, renderer.domElement);
    this.orbitControls.target = new THREE.Vector3(0, 0, 0); //控制焦点
    this.orbitControls.autoRotate = false;
    this.orbitControls.zoomSpeed = 3;
    //上下翻转的最大仰视角和俯视角。范围0-Math.PI 弧度，一个pi代表180°
    this.orbitControls.minPolarAngle = 0;
    this.orbitControls.maxPolarAngle = 1.5;
    this.orbitControls.addEventListener('change', function (e) {
      // this.azimuthalAngle = e.target.getAzimuthalAngle();
      // this.polarAngle = e.target.getPolarAngle();
      // console.log(this.azimuthalAngle, this.polarAngle);
    });

    //场景
    this.scene = new THREE.Scene();
    // this.scene.fog = new THREE.Fog(0xd7cbb1, 5, 80);

    //创建矩形地面网格
    const halfMapWidth = this.mapWH.map_width / 2;
    const halfMapHeight = this.mapWH.map_height / 2;
    const geometryX = new THREE.Geometry(); //创建点的集合
    geometryX.vertices.push(
      new THREE.Vector3(-halfMapWidth, 0, -halfMapHeight),
      new THREE.Vector3(halfMapWidth, 0, -halfMapHeight),
    );
    const geometryZ = new THREE.Geometry();
    geometryZ.vertices.push(
      new THREE.Vector3(-halfMapWidth, 0, -halfMapHeight),
      new THREE.Vector3(-halfMapWidth, 0, halfMapHeight),
    );
    const material = new THREE.LineBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.2,
    });
    const widthRate = this.mapWH.map_width / map_size;
    const heightRate = this.mapWH.map_height / map_size;
    for (var i = 0; i <= map_size; i++) {
      var lineX = new THREE.Line(geometryX, material);
      lineX.position.z = i * heightRate;
      this.scene.add(lineX);
      var lineZ = new THREE.Line(geometryZ, material);
      lineZ.position.x = i * widthRate;
      this.scene.add(lineZ);
    }

    //字体加载
    this.loadFont();

    //立方体纹理（天空盒）
    await this.loadCubeTexture(renderer);

    //载入汽车3D模型及材质
    await this.load3dObj(data.start_area);

    //加载地图
    this.loadObstacles(data.obstacles);

    //渲染器自动渲染，每个可用帧都会调用的函数
    renderer.setAnimationLoop(() => {
      this.renderCar();
      renderer.render(this.scene, camera);
    });
  }

  //加载字体
  loadFont() {
    this.textFont = new THREE.FontLoader().parse(
      require('assets/car/fonts/optimer_bold.typeface.json'),
    );
  }

  //加载立方体纹理（天空盒）
  loadCubeTexture(renderer) {
    //六张图片分别是朝前的（posz）、朝后的（negz）、朝上的（posy）、朝下的（negy）、朝右的（posx）和朝左的（negx）。
    return new Promise((resolve, reject) => {
      const urls = [
        require('assets/car/skyboxsun25deg/px.jpg'),
        require('assets/car/skyboxsun25deg/nx.jpg'),
        require('assets/car/skyboxsun25deg/py.jpg'),
        require('assets/car/skyboxsun25deg/ny.jpg'),
        require('assets/car/skyboxsun25deg/pz.jpg'),
        require('assets/car/skyboxsun25deg/nz.jpg'),
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
      THREE.DRACOLoader.setDecoderPath('car/js/libs/draco/gltf/');
      const loader = new THREE.GLTFLoader();
      loader.setDRACOLoader(new THREE.DRACOLoader());
      THREE.DRACOLoader.getDecoderModule();
      loader.load(
        require('assets/car/ferrari.glb'),
        gltf => {
          this.carModel = gltf.scene.children[0];
          const xy = this.translateVector(startArea.nodes[0]);

          this.car.setModel(this.carModel, startArea.direction, xy.x, xy.y);
          this.carModel.traverse(child => {
            if (child.isMesh) {
              child.material.envMap = this.envMap;
            }
          });
          // 阴影
          var texture = new THREE.TextureLoader().load(require('assets/car/ferrari_ao.png'));
          var shadow = new THREE.Mesh(
            new THREE.PlaneBufferGeometry(0.655 * 4, 1.3 * 4).rotateX(-Math.PI / 2),
            new THREE.MeshBasicMaterial({ map: texture, opacity: 0.8, transparent: true }),
          );
          shadow.renderOrder = 2;
          shadow.position.set(0, 0.02, 0);
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
    this.carParts.body.forEach(function (part) {
      part.material = bodyMat;
    });
    this.carParts.rims.forEach(function (part) {
      part.material = rimMat;
    });
    this.carParts.glass.forEach(function (part) {
      part.material = glassMat;
    });
  }

  //加载地图
  loadObstacles(obstacles) {
    const color = 0x0000ff;
    if (obstacles) {
      const material = new THREE.MeshBasicMaterial({
        color,
        opacity: 0.6,
        depthWrite: false,
        transparent: true,
      });
      let mesh = null;
      _.each(obstacles, obj => {
        const xy = this.translateVector(obj.coordinate);
        if (mesh) {
          mesh = mesh.clone();
          mesh.geometry = new THREE.BoxGeometry(
            obj.dimension.width,
            obj.dimension.height,
            obj.dimension.length,
          );
        } else {
          mesh = new THREE.Mesh(
            new THREE.BoxGeometry(obj.dimension.width, obj.dimension.height, obj.dimension.length),
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
      this.orbitControls.object.lookAt(
        this.carModel.position.x,
        this.carModel.position.y,
        this.carModel.position.z,
      );
      this.orbitControls.target = this.carModel.position;

      //汽车转弯时相机的相对位置
      const x = this.carModel.position.x + 10 * Math.sin(carOrientation - Math.PI / 2);
      const z = this.carModel.position.z + 10 * Math.cos(carOrientation - Math.PI / 2);
      //控制器对相机的偏移
      const _x = 0,
        _y = 0,
        _z = 0;

      //控制器控制相机的位置
      this.orbitControls.object.position.set(x + _x, this.carModel.position.y + 10 + _y, z + _z);

      this.orbitControls.update();
    }

    //已行驶路径
    if (this.drivePath) {
      if (this.drivePath.isLine2) {
        this.drivePath.geometry.dispose();
        this.drivePath.material.dispose();
      }
      this.scene.remove(this.drivePath);
    }
    this.drivePathPoint.push(xy.x, 0.2, xy.y);
    this.refreshDrivePath(this.drivePathPoint, 0xdc143c);

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
    //0x0dc3b4
    this.refreshObject(objectArray, 0x228b22);
  }

  //-------路线材料，避免多次实例化--------
  lineMaterial = new THREE.LineMaterial({
    color: 0xcdcd00,
    depthWrite: true,
    linewidth: 0.005, // in pixels
  });

  //刷新已行驶过的路径
  refreshDrivePath(drivePathPoint, color) {
    let geometry = new THREE.LineGeometry();
    geometry.setPositions(drivePathPoint);
    const meterial = this.lineMaterial.clone();
    if (color) {
      meterial.setValues({
        color,
      });
    }
    this.drivePath = new THREE.Line2(geometry, meterial);
    this.drivePath.renderOrder = 4;
    this.scene.add(this.drivePath);
  }

  //刷新某帧路径规划
  refreshRouting(routingArray, color) {
    if (!_.isEmpty(routingArray)) {
      const arr = [];
      _.each(routingArray, xyz => {
        const xy = this.translateVector({ x: xyz.x, y: xyz.z });
        arr.push(xy.x, 0, xy.y);
      });

      if (!this.pathRoutingLine) {
        const meterial = this.lineMaterial.clone();
        if (color) {
          meterial.setValues({
            color,
            transparent: true,
          });
        }
        this.pathRoutingLine = new THREE.Line2(new THREE.LineGeometry(), meterial);
        this.pathRoutingLine.renderOrder = 3;
      }
      this.pathRoutingLine.geometry.setPositions(arr);
      this.scene.add(this.pathRoutingLine);
    }
  }

  //刷新某帧物体
  refreshObject(objectArray, color) {
    if (!_.isEmpty(objectArray)) {
      let mesh = null;
      let material = new THREE.MeshBasicMaterial({ color, opacity: 0.7, transparent: true });
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
    const x = point.x - this.mapWH.map_width / 2;
    const y = point.y - this.mapWH.map_height / 2;
    return { x, y };
  }
}

export default VirtualDrive;
