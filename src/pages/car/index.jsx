import React, { PureComponent } from 'react';
import _ from 'lodash';
import Drive from './Drive';

class Index extends PureComponent {
  state = {
    map: null,
    frame: null,
  };

  componentWillMount() {
    fetch('./shanghai.json', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
      .then(response => response.json()) //解析为Promise
      .then(data => {
        this.setState({
          map: data,
        });
      });
  }

  componentDidMount() {
    this.freshFrame();
  }

  freshFrame() {
    setInterval(() => {
      const vector3Array = [];
      for (let i = 0; i < 10; i++) {
        vector3Array.push({ x: _.random(-50, 50), y: -0.5, z: _.random(-50, 50) });
      }
      const objectsArray = [];
      for (let i = 0; i < 3; i++) {
        const width = _.random(1, 3.5),
          length = _.random(1, 5);
        objectsArray.push({
          x: _.random(-length, length) * 10,
          y: 0,
          z: _.random(-width, width) * 10,
          width,
          height: 2,
          length,
        });
      }

      this.setState({
        frame: {
          speed: _.random(-1.5, 5),
          wheelOrientation: _.random(-1, 1),
          routingArray: vector3Array,
          objectArray: objectsArray,
        },
      });
    }, 1000);
  }

  render() {
    const { map, frame } = this.state;
    return map ? <Drive height={window.innerHeight - 4} map={map} frame={frame} /> : null;
  }
}

export default Index;
