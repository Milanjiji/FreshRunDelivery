/**
 * @format
 */

import React from 'react';
import { AppRegistry, Text, TextInput } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Global font configuration
if (!Text.defaultProps) Text.defaultProps = {};
Text.defaultProps.style = { fontFamily: 'Inter-Regular' };

if (!TextInput.defaultProps) TextInput.defaultProps = {};
TextInput.defaultProps.style = { fontFamily: 'Inter-Regular' };

AppRegistry.registerComponent(appName, () => App);
