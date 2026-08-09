#!/usr/bin/env -S node --no-warnings
/*
 
 */

const { version } = require('../package.json');
const { AgentCLI } = require('../dist');
new AgentCLI({ version, binName: 'tarko' }).bootstrap();
