# Estilos Opovisual guardados para reutilizar

## Estilo E · «Árbol con conectores» (aprobado para replicar más adelante)

Archivo de referencia: `decreto-51-2025-muestra-E.html` (página 1), CSS en el bloque
«Página 1 · Estructura en árbol con conectores (opción E)».

- Uso: mostrar una jerarquía de dos niveles (Título → Capítulos, apartado → subapartados).
- Nodo padre: bloque azul marino `#143548`, ancho fijo ~196 px, `border-radius: 12px`,
  etiqueta pequeña en mayúsculas Poppins SemiBold 8.6 px azul claro (`#9ddfea`) y nombre en
  Poppins SemiBold 12.6 px blanco. Variante sin hijos: fondo `#9ddfea` y texto azul marino.
- Conector: línea de 1.4 px azul marino que sale del centro del bloque y se abre en una llave
  (vertical desde el centro del primer hijo al del último, con un tramo horizontal a cada hijo).
- Nodo hijo: cajita blanca con borde 1.3 px azul marino, `border-radius: 7px`, número romano en
  Lora Bold 12 px azul marino + texto Poppins Regular 11.2 px.
- Separación entre hijos 8 px; entre grupos 16 px. Sin sombras ni degradados.

## Notas generales que ha pedido la clienta

- Evitar diseños «de IA» genéricos (tarjetas en cuadrícula) y los demasiado textuales: buscar
  recursos gráficos.
- No calcar literalmente la muestra resuelta: inspirarse en ella (colores, pesos, toques a mano).
- Nada de sombras difuminadas ni degradados (se ven mal en su ordenador); si hace falta
  profundidad, sombra sólida desplazada.
- Tracking por defecto en los textos pequeños en mayúsculas.

## Portada · aprobada (Decreto 51/2025)

Archivo: `decreto-51-2025-muestra.html`, sección «PORTADA».

- Misma estructura que la muestra resuelta: banda ilustrada arriba (0–381 px), franja blanca
  central (381–838 px) y banda ilustrada abajo, sobre fondo `#d1edf9`.
- La ilustración se razona a partir del contenido (Constitución → columnas; empleo público →
  filas de figuras de personas en `#9ddfea` / `#bae7f3`, con una destacada en azul marino).
- Franja blanca: antetítulo en mayúsculas espaciadas Poppins Bold 15 px · título Poppins Bold
  46/52 px en dos líneas · subrayado a mano · resto del título en Poppins 14/22 px · chips con
  los bloques del contenido · logo VJL centrado.
- El texto sale literal del documento, solo repartido en niveles tipográficos.
