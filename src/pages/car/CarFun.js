/* eslint-disable */
export default THREE => {
  THREE.Car = (function() {
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

    function Car() {
      this.elemNames = {
        flWheel: 'wheel_fl',
        frWheel: 'wheel_fr',
        rlWheel: 'wheel_rl',
        rrWheel: 'wheel_rr',
        steeringWheel: 'steering_wheel', // set to null to disable
      };

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
        root.rotation.y = direction;

        this.setupWheels();
      },
      setChange(carOrientation, position) {
        // rotation while steering
        // frontLeftWheelRoot.rotation[this.wheelTurnAxis] = carOrientation * 0.02;
        // frontRightWheelRoot.rotation[this.wheelTurnAxis] = carOrientation * 0.02;

        //方向盘的滚动
        steeringWheel.rotation[this.steeringWheelTurnAxis] = -carOrientation * 6;

        // 车的运动坐标随着时间以及汽车参数变化
        root.position.x = position.x;
        root.position.z = position.y;
        // 车的角度
        root.rotation.y = -Math.PI / 2 + carOrientation;

        frontLeftWheel.rotation[this.wheelRotationAxis] += 2;
        frontRightWheel.rotation[this.wheelRotationAxis] += 2;
        backLeftWheel.rotation[this.wheelRotationAxis] += 2;
        backRightWheel.rotation[this.wheelRotationAxis] += 2;
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
    };
    return Car;
  })();
};
