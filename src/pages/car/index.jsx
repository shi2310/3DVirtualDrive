import React, { PureComponent } from 'react';
import axios from 'axios';
import Drive from './Drive';
import style from './index.less';

class Index extends PureComponent {
  state = {
    map: null,
    frame: null,
    followCamera: false,
  };

  componentWillMount() {
    fetch('./shanghai.json', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    })
      .then(response => response.json())
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
    axios.get('http://localhost:3003/public/data.json').then(rsp => {
      let i = 0;
      const timer = setInterval(() => {
        let item = rsp.data[i];
        if (item) {
          const frame = {
            heading: item.localization.heading || 0,
            localization: item.localization,
            planning: item.path_planning.points || [],
            perception: item.perception.objects || [],
          };
          this.setState({
            frame,
          });
        }
        i++;
        if (i === rsp.data.length) {
          clearInterval(timer);
        }
      }, 10);
    });
  }

  ckbChange() {
    this.setState({
      followCamera: !this.state.followCamera,
    });
  }

  render() {
    const { map, frame, followCamera } = this.state;
    return (
      <div style={{ height: window.innerHeight - 4 }}>
        <div className={style.info}>
          汽车跟随视角:
          <input type="checkbox" checked={followCamera} onChange={this.ckbChange.bind(this)} />
        </div>
        <Drive map={map} frame={frame} followCamera={followCamera} />
      </div>
    );
  }
}

export default Index;
