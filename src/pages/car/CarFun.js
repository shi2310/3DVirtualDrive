/* eslint-disable */
export default THREE => {
  THREE.Car = (function() {
    //车子方向
    let carOrientation = 0;
    //车轮直径
    let wheelDiameter = 1;
    //
    let length = 1;

    let root = null;
    //场景中的左前轮对象
    let frontLeftWheelRoot = null;
    //场景中的右前轮对象
    let frontRightWheelRoot = null;

    //左前轮
    let frontLeftWheel = new THREE.Group();
    //右前轮
    let frontRightWheel = new THREE.Group();
    //场景中的左后轮
    let backLeftWheel = null;
    //场景中的右后轮
    let backRightWheel = null;
    //方向盘
    let steeringWheel = null;

    let loaded = false;

    function Car() {
      this.elemNames = {
        flWheel: 'wheel_fl',
        frWheel: 'wheel_fr',
        rlWheel: 'wheel_rl',
        rrWheel: 'wheel_rr',
        steeringWheel: 'steering_wheel', // set to null to disable
      };

      // 转弯半径
      this.turningRadius = 75;
      this.speed = 0;
      this.wheelOrientation = 0;

      // 车轮转角轴
      this.wheelRotationAxis = 'x';
      // 车轮滚动（直行）轴
      this.wheelTurnAxis = 'z';
      // 方向盘滚动轴
      this.steeringWheelTurnAxis = 'y';
    }

    Car.prototype = {
      constructor: Car,
      setModel: function(model, direction, x, y, elemNames) {
        if (elemNames) this.elemNames = elemNames;
        root = model;
        // 车的运动坐标随着时间以及汽车参数变化
        root.position.x = x || 0;
        root.position.z = y || 0;
        // 车的角度
        root.rotation.y = 1 * 0.02 * this.turningRadius;

        this.setupWheels();
        this.computeDimensions();
        loaded = true;
      },
      //汽车的速度及车轮转向变化
      setChange(speed, wheelOrientation) {
        this.speed = speed;
        this.wheelOrientation = wheelOrientation;

        // rotation while steering
        frontLeftWheelRoot.rotation[this.wheelTurnAxis] = this.wheelOrientation;
        frontRightWheelRoot.rotation[this.wheelTurnAxis] = this.wheelOrientation;

        //方向盘的滚动
        steeringWheel.rotation[this.steeringWheelTurnAxis] = this.wheelOrientation * 6;
      },
      //间隔时间内的渲染
      render: function(delta) {
        if (!loaded) return;

        //向前的变量增量
        var forwardDelta = -this.speed * delta;
        // 车的方向
        carOrientation -= forwardDelta * this.turningRadius * 0.02 * this.wheelOrientation;

        // 车的运动坐标随着时间以及汽车参数变化
        root.position.x += Math.sin(carOrientation) * forwardDelta * length;
        root.position.z += Math.cos(carOrientation) * forwardDelta * length;
        // 车的角度
        root.rotation.y = carOrientation;

        // 角速比
        var angularSpeedRatio = -2 / wheelDiameter;
        //车轮变量增量
        var wheelDelta = forwardDelta * angularSpeedRatio * length;

        frontLeftWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
        frontRightWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
        backLeftWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
        backRightWheel.rotation[this.wheelRotationAxis] -= wheelDelta;
      },
      getPosition() {
        return { ...root.position };
      },
      setupWheels: function() {
        frontLeftWheelRoot = root.getObjectByName(this.elemNames.flWheel);
        frontRightWheelRoot = root.getObjectByName(this.elemNames.frWheel);
        backLeftWheel = root.getObjectByName(this.elemNames.rlWheel);
        backRightWheel = root.getObjectByName(this.elemNames.rrWheel);
        if (this.elemNames.steeringWheel !== null)
          steeringWheel = root.getObjectByName(this.elemNames.steeringWheel);

        while (frontLeftWheelRoot.children.length > 0)
          frontLeftWheel.add(frontLeftWheelRoot.children[0]);
        while (frontRightWheelRoot.children.length > 0)
          frontRightWheel.add(frontRightWheelRoot.children[0]);

        frontLeftWheelRoot.add(frontLeftWheel);
        frontRightWheelRoot.add(frontRightWheel);
      },
      computeDimensions: function() {
        var bb = new THREE.Box3().setFromObject(frontLeftWheelRoot);
        var size = new THREE.Vector3();
        bb.getSize(size);
        wheelDiameter = Math.max(size.x, size.y, size.z);
        bb.setFromObject(root);
        size = bb.getSize(size);
        length = Math.max(size.x, size.y, size.z);
      },
    };
    return Car;
  })();
};
