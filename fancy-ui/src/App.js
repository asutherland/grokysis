import React, { Component } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { ConnectedRouter } from 'react-router-redux';

import CrashesRootPage from './containers/pages/'

import logo from './logo.svg';
import './App.css';

class App extends Component {
  render() {
    return (<div>
      <Provider store={ store }>
        <ConnectedRouter history={ history }>
          <Switch>
            <Route exact path='/crashes/'
                   component={ CrashesRootPage }/>
            <Route exact path='/crashes/session/:sessionId/'
                   component={ CrashSessionPage }/>
            <Redirect to='/crashes/' />
          </Switch>
        </ConnectedRouter>
      </Provider>

      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React</h1>
        </header>
        <p className="App-intro">
          To get started, edit <code>src/App.js</code> and save to reload.
        </p>
      </div>
    </div>
    );
  }
}

export default App;
