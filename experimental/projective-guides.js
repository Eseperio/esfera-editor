'use strict';
// A guide region is bounded by two line segments that each run from the
// left edge of a hole towards its right edge. The horizontal parameter t
// interpolates between their corresponding endpoints. This is a ruled
// interpolation, not a full projective homography or automatic detection.
function pointOnLine(line,t){return {x:line[0].x+(line[1].x-line[0].x)*t,y:line[0].y+(line[1].y-line[0].y)*t};}
function pointInRegion(region,t,s){const a=pointOnLine(region[0],t),b=pointOnLine(region[1],t);return {x:a.x+(b.x-a.x)*s,y:a.y+(b.y-a.y)*s};}
function projectToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy;const t=d?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/d)):0;const x=a.x+t*dx,y=a.y+t*dy;return {x,y,t,distance:Math.hypot(p.x-x,p.y-y)};}
// Estimate a coordinate within a non-parallel quadrilateral by numerically
// minimizing distance to its interpolated cross-section.
function regionCoordinates(region,p){let best={distance:Infinity};for(let i=0;i<=64;i++){let t=i/64,a=pointOnLine(region[0],t),b=pointOnLine(region[1],t),hit=projectToSegment(p,a,b);if(hit.distance<best.distance)best={t,s:hit.t,distance:hit.distance};}return best;}
function nearestRegion(regions,p){let best=null;for(let i=0;i<regions.length;i++){const coords=regionCoordinates(regions[i],p);if(!best||coords.distance<best.distance)best={index:i,...coords};}return best;}
function samplesForPoint(region,p){const coords=regionCoordinates(region,p);return {left:pointInRegion(region,0,coords.s),right:pointInRegion(region,1,coords.s),weight:coords.t,distance:coords.distance};}
module.exports={pointOnLine,pointInRegion,regionCoordinates,nearestRegion,samplesForPoint};
