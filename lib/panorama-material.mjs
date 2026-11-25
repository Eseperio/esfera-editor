import {
  RepeatWrapping,
  ClampToEdgeWrapping,
  SRGBColorSpace,
} from "../node_modules/three/build/three.module.js";

export function configurePanoramaTexture(texture, anisotropy = 1) {
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.anisotropy = anisotropy;
  texture.needsUpdate = true;
  return texture;
}

export const panoramaVertexShader = `
varying vec2 pos;
void main() {
  pos = position.xy;
  gl_Position = vec4(position.xy, 0., 1.);
}`;

export const panoramaFragmentShader = `
uniform sampler2D image, selection;
uniform float lon, lat, aspect, fov, stereoFov, blend, showSelection;
varying vec2 pos;
void main() {
  vec3 f = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));
  vec3 r = vec3(-sin(lon), 0., cos(lon));
  vec3 up = cross(r, f);
  vec2 p = vec2(pos.x * aspect, pos.y);
  float radius = length(p);
  float theta = mix(atan(radius * tan(fov / 2.)),
                   2. * atan(radius * tan(stereoFov / 4.)), blend);
  vec3 d = radius < 0.00001 ? f :
    f * cos(theta) + (r * p.x + up * p.y) / radius * sin(theta);
  vec2 uv = vec2(fract(atan(d.z, d.x) / 6.28318530718 + 1.),
                 1. - acos(clamp(d.y, -1., 1.)) / 3.14159265359);
  // A longitude wrap is adjacent pixels, not a whole-texture footprint.
  // Correct explicit gradients so mipmaps/anisotropy stay continuous at 0/360.
  vec2 dx = dFdx(uv);
  vec2 dy = dFdy(uv);
  dx.x -= floor(dx.x + 0.5);
  dy.x -= floor(dy.x + 0.5);
  vec4 color = textureGrad(image, uv, dx, dy);
  vec4 mask = textureGrad(selection, uv, dx, dy);
  gl_FragColor = vec4(mix(color.rgb, mask.rgb, mask.a * .55 * showSelection), 1.);
  #include <colorspace_fragment>
}`;
