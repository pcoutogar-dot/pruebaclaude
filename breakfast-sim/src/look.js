// Aspecto "cute 3D mate" para todo el juego, aplicado a los shaders de three.js:
//  - luz envolvente (wrap lighting): el paso de luz a sombra es suave, como arcilla
//  - todo es mate (rugosidad mínima), salvo el cristal
//  - un borde de luz suave en los contornos (rim) que redondea las formas
//  - las sombras no son grises: toman un tono cálido
import * as THREE from 'three';

const C = THREE.ShaderChunk;

// solo la parte difusa (el color) envuelve; el brillo especular queda como estaba
C.lights_physical_pars_fragment = C.lights_physical_pars_fragment.replace(
  '\treflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
  '\treflectedLight.directDiffuse += saturate( ( dot( geometryNormal, directLight.direction ) + 0.4 ) / 1.4 ) * directLight.color * BRDF_Lambert( material.diffuseColor );',
);

C.roughnessmap_fragment += `
#ifndef USE_TRANSMISSION
  roughnessFactor = max( roughnessFactor, 0.55 );
#endif
`;

C.lights_fragment_end += `
#if defined( PHYSICAL ) && !defined( USE_TRANSMISSION )
  {
    // con la normal sin relieve: evita valores inválidos (destellos) en bordes con bump
    float rimF = pow( 1.0 - saturate( dot( normalize( nonPerturbedNormal ), geometryViewDir ) ), 3.0 );
    if ( rimF != rimF ) rimF = 0.0;
    reflectedLight.indirectDiffuse += material.diffuseColor * rimF * 0.16;
    // sombra con color: un toque cálido-rosado en las zonas menos iluminadas
    reflectedLight.indirectDiffuse += material.diffuseColor * vec3( 0.035, 0.018, 0.024 );
  }
#endif
`;


