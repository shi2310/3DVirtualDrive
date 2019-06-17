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
    var axis = new THREE.AxisHelper(100);
    // 在场景中添加坐标轴
    this.scene.add(axis);

    //字体加载
    await this.loadFont();

    //立方体纹理（天空盒）
    await this.loadCubeTexture(renderer);

    //载入汽车3D模型及材质
    await this.load3dObj(data.start_area);

    //加载障碍物
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

  //加载障碍物
  loadObstacles(obstacles) {
    if (obstacles) {
      _.each(obstacles, obj => {
        const xy = this.translateVector(obj.coordinate);
        var mesh = new THREE.Mesh(
          new THREE.BoxGeometry(obj.dimension.width, obj.dimension.height, obj.dimension.length),
          new THREE.MeshBasicMaterial({ color: 0x3a5fcd, opacity: 0.8, transparent: true }),
        );

        //物体沿中心扩展x，所以X轴偏移要加上width一半
        const x = xy.x + obj.dimension.width / 2;
        //物体沿中心扩展y，所以y轴偏移要加上height一半
        const z = xy.y + obj.dimension.length / 2;

        mesh.position.set(x, obj.dimension.height / 2, z);
        console.log(x, z, obj.dimension.length / 2);
        this.scene.add(mesh);
      });
    }
  }

  //某帧汽车数据的加载
  carFrame(speed, wheelOrientation, routingArray, objectArray) {
    this.car.setChange(speed, wheelOrientation);

    if (this.pathRoutingLine) {
      this.scene.remove(this.pathRoutingLine);
      this.pathRoutingLine.remove();
    }
    this.refreshRouting(routingArray, 0xc1ffc1);

    if (this.objects) {
      _.each(this.objects, obj => {
        this.scene.remove(obj);
        obj.remove();
      });
    }
    this.refreshObject(objectArray, 0x0000dd);
  }

  //刷新某帧路径规划
  refreshRouting(routingArray, color) {
    if (routingArray) {
      const arr = [];
      _.each(routingArray, xyz => {
        arr.push(xyz.x, xyz.y, xyz.z);
      });
      var geometry = new THREE.LineGeometry(0, 0, 0);
      geometry.setPositions(arr);
      this.pathRoutingLine = new THREE.Line2(
        geometry,
        new THREE.LineMaterial({
          color: color || 0xe0eeee,
          linewidth: 0.01,
          opacity: 0.5,
        }),
      );
      this.scene.add(this.pathRoutingLine);
    }
  }

  //刷新某帧物体
  refreshObject(objectArray, color) {
    if (!_.isEmpty(objectArray)) {
      _.each(objectArray, object => {
        var mesh = new THREE.Mesh(
          new THREE.BoxGeometry(object.width, object.height, object.length),
          new THREE.MeshBasicMaterial({ color: color }),
        );
        mesh.position.set(object.x, object.y + object.height / 2, object.z);
        this.objects.push(mesh);
        this.scene.add(mesh);
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
    //两次调用之间的间隔时间
    var delta = this.clock.getDelta();
    if (this.carModel) {
      //渲染汽车的运动轨迹
      this.car.render(delta / 3);

      if (this.followCamera === true) {
        this.carModel.getWorldPosition(this.cameraTarget);
        this.cameraTarget.y = 2.5;
        this.cameraTarget.z += 5;
        this.camera.position.lerp(this.cameraTarget, delta * 5.0);
        this.camera.lookAt(this.carModel.position);
      }
    }
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
