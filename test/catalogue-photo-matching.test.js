const test = require('node:test');
const assert = require('node:assert/strict');
const { resolvePhotoAssignments } = require('../prisma/catalogue-photo-matching');

test('uses exact product and pack mapping when supplied', () => {
  const rows = [{id:'1',name:'Example',bottleFormat:'750ml Bottle'},{id:'2',name:'Example',bottleFormat:'Can (500ml)'}];
  const exact = { [JSON.stringify(['Example','Can (500ml)'])]: '/images/example-can.png' };
  const assigned = resolvePhotoAssignments(rows,{Example:'/images/example-bottle.png'},exact);
  assert.equal(assigned.find(x=>x.id==='2').imageUrl,'/images/example-can.png');
  assert.equal(assigned.find(x=>x.id==='2').matchType,'format');
  assert.equal(assigned.find(x=>x.id==='1').imageUrl,'/images/example-bottle.png');
});

test('uses the brand photo as fallback for other pack formats, like iCamagu', () => {
  const rows=[
    {id:'1',name:'Example',bottleFormat:'750ml Bottle'},
    {id:'2',name:'Example',bottleFormat:'Can (500ml)'},
    {id:'3',name:'Example',bottleFormat:'Dumpy (330ml)'}
  ];
  const assigned=resolvePhotoAssignments(rows,{Example:'/images/example.png'});
  assert.equal(assigned.length,3);
  assert.ok(assigned.every(x=>x.imageUrl==='/images/example.png' && x.matchType==='brand'));
});

test('does not assign an image when neither exact nor brand photo exists', () => {
  const rows=[{id:'1',name:'Unknown',bottleFormat:'750ml Bottle'}];
  assert.deepEqual(resolvePhotoAssignments(rows,{}),[]);
});

test('exact pack mapping takes priority over brand fallback', () => {
  const rows=[{id:'1',name:'Example',bottleFormat:'Can (500ml)'}];
  const exact={ [JSON.stringify(['Example','Can (500ml)'])]:'/images/can.png' };
  assert.equal(resolvePhotoAssignments(rows,{Example:'/images/bottle.png'},exact)[0].imageUrl,'/images/can.png');
});
