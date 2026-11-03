const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePhotoAssignments } = require('../prisma/catalogue-photo-matching');

test('uses exact product and pack mapping when supplied', () => {
  const rows = [{id:'1',name:'Example',bottleFormat:'750ml Bottle'},{id:'2',name:'Example',bottleFormat:'Can (500ml)'}];
  const exact = { [JSON.stringify(['Example','Can (500ml)'])]: '/images/example-can.png' };
  assert.deepEqual(resolvePhotoAssignments(rows,{Example:'/images/example-bottle.png'},exact),[
    {id:'2',name:'Example',bottleFormat:'Can (500ml)',imageUrl:'/images/example-can.png'}
  ]);
});
test('does not spread a brand photo across multiple pack formats', () => {
  const rows=[{id:'1',name:'Example',bottleFormat:'750ml Bottle'},{id:'2',name:'Example',bottleFormat:'Can (500ml)'},{id:'3',name:'Example',bottleFormat:'Dumpy (330ml)'}];
  assert.deepEqual(resolvePhotoAssignments(rows,{Example:'/images/example.png'}),[]);
});
test('allows brand fallback for a single-format SKU', () => {
  const rows=[{id:'1',name:'Example',bottleFormat:'750ml Bottle'}];
  assert.deepEqual(resolvePhotoAssignments(rows,{Example:'/images/example.png'}),[
    {id:'1',name:'Example',bottleFormat:'750ml Bottle',imageUrl:'/images/example.png'}
  ]);
});
test('exact pack mapping takes priority over brand fallback', () => {
  const rows=[{id:'1',name:'Example',bottleFormat:'Can (500ml)'}];
  const exact={ [JSON.stringify(['Example','Can (500ml)'])]:'/images/can.png' };
  assert.equal(resolvePhotoAssignments(rows,{Example:'/images/bottle.png'},exact)[0].imageUrl,'/images/can.png');
});
