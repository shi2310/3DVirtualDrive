import React, { PureComponent } from 'react';
import _ from 'lodash';
import { VirtualDrive } from './VirtualDrive';

class Drive extends PureComponent {
  virtualDrive = null;

  state = {
    initOver: false,
  };

  componentWillReceiveProps(newProps) {
    if (newProps.map && !_.isEqual(this.props.map, newProps.map)) {
      const container = document.getElementById('body');
      //根据传递进来的map数据初始化虚拟驾驶环境
      this.virtualDrive = new VirtualDrive(container, newProps.map, () => {
        this.setState({
          initOver: true,
        });
      });
    }
  }

  componentDidUpdate(prevProps) {
    //虚拟驾驶环境已经初始化完成
    if (this.state.initOver) {
      //根据followCamera状态来变更虚拟驾驶环境中的汽车视角跟随
      if (!_.isEqual(this.props.followCamera, prevProps.followCamera)) {
        this.virtualDrive.followCamera = this.props.followCamera;
      }

      //根据父组件传递的每一帧数据进行绘制
      if (this.props.frame && !_.isEqual(this.props.frame, prevProps.frame)) {
        const item = this.translateJSON(this.props.frame);
        this.virtualDrive.carFrame(
          -item.heading,
          item.position,
          item.routingArray,
          item.objectArray,
        );
      }
    }
  }

  translateJSON(item) {
    const timestamp = item.timestamp / 1000000000;
    const x0 = item.localization.x;
    const y0 = item.localization.y;
    //车头方向
    const heading = item.heading;

    //路径规划
    const routingArray = _.reduce(
      item.planning,
      (array, o) => {
        array.push({ x: o.x, y: 0.03, z: o.y });
        return array;
      },
      [],
    );

    const objectArray = [];
    //障碍物
    if (!_.isEmpty(item.perception)) {
      _.map(item.perception, item => {
        const { x, y } = this.transform_to_map_coordinate(x0, y0, item.x, item.y, heading);
        //给出的point是从左上角开始，point需要转为物体中心
        objectArray.push({
          x: x + item.width / 2,
          y: 0,
          z: y + item.length / 2,
          width: item.width,
          height: 4,
          length: item.length,
        });
      });
    }

    return {
      timestamp,
      position: { x: x0, y: y0 },
      heading,
      routingArray,
      objectArray,
    };
  }

  transform_to_map_coordinate(x0, y0, x, y, pose) {
    const scaler = 0.5;
    const _x = parseFloat(x / scaler);
    const _y = parseFloat(y / scaler);
    const x_new = _x * Math.cos(-0.5 * Math.PI - pose) - _y * Math.sin(-0.5 * Math.PI - pose);
    const y_new = _x * Math.sin(-0.5 * Math.PI - pose) + _y * Math.cos(-0.5 * Math.PI - pose);
    return { x: x0 + x_new, y: y0 - y_new };
  }

  render() {
    return <div id="body" style={{ width: '100%', height: '100%', display: 'block' }} />;
  }
}

export default Drive;
