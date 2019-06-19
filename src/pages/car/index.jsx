import React, { PureComponent } from 'react';
import axios from 'axios';
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
    axios.get('./data.json').then(rsp => {
      let i = 0;
      const timer = setInterval(() => {
        let item = rsp.data[i];
        if (item) {
          const frame = {
            carOrientation: -item.heading - Math.PI / 2,
            position: item.position,
            routingArray: item.routingArray,
            objectArray: item.objectArray,
          };
          this.setState({
            frame,
          });
        }
        i++;
        if (i === rsp.data.length) {
          clearInterval(timer);
        }
      }, 100);
    });
  }

  render() {
    const { map, frame } = this.state;
    return (
      <div style={{ height: window.innerHeight - 4 }}>
        {map ? <Drive map={map} frame={frame} /> : null}
      </div>
    );
  }
}

export default Index;
