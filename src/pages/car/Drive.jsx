import React, { PureComponent } from 'react';
import _ from 'lodash';
import { VirtualDrive } from './VirtualDrive';
import style from './Drive.less';

class Drive extends PureComponent {
  virtualDrive = null;

  state = {
    initOver: false,
    followCamera: false,
  };

  componentDidMount() {
    const container = document.getElementById('body');
    //根据传递进来的map数据初始化虚拟驾驶环境
    this.virtualDrive = new VirtualDrive(container, this.props.map, () => {
      this.setState({
        initOver: true,
      });
    });
  }

  componentDidUpdate(prevProps, prevState) {
    //虚拟驾驶环境已经初始化完成
    if (this.state.initOver) {
      //根据followCamera状态来变更虚拟驾驶环境中的汽车视角跟随
      if (!_.isEqual(this.state.followCamera, prevState.followCamera)) {
        this.virtualDrive.followCamera = this.state.followCamera;
      }
      //根据父组件传递的每一帧数据进行绘制
      if (this.props.frame && !_.isEqual(this.props.frame, prevProps.frame)) {
        const { carOrientation, position, routingArray, objectArray } = this.props.frame;
        this.virtualDrive.carFrame(carOrientation, position, routingArray, objectArray);
      }
    }
  }

  ckbChange() {
    this.setState({
      followCamera: !this.state.followCamera,
    });
  }

  render() {
    return (
      <>
        <div className={style.info}>
          汽车跟随视角:
          <input
            type="checkbox"
            checked={this.state.followCamera}
            onChange={this.ckbChange.bind(this)}
          />
        </div>
        <div id="body" style={{ width: '100%', height: '100%', display: 'block' }} />
      </>
    );
  }
}

export default Drive;
