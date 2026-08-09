#!/usr/bin/env -S node --no-warnings
/*
 
 */

const { version } = require('../package.json');
const { AgentTARSCLI } = require('../dist');
new AgentTARSCLI({ version }).bootstrap();
