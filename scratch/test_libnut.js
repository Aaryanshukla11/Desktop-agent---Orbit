const libnut = require('@computer-use/libnut-win32');
console.log('libnut keys:', Object.keys(libnut));
console.log('getMousePos:', libnut.getMousePos());
libnut.moveMouse(500, 500);
console.log('after moveMouse(500, 500):', libnut.getMousePos());
