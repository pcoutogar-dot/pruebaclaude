# Informe 43.ª promoción · Academia Nacional — preparación para InDesign

## Archivos
- `INFORME_43_texto_limpio_con_estilos.docx`: texto completo, sin párrafos vacíos ni saltos improvisados, con estilos nombrados `AN_*`. Al colocarlo en InDesign (*Opciones de importación → Importar estilos automáticamente*), cada estilo de Word se crea con el mismo nombre y se redefine con la tipografía y el color de marca.
- `tablas/*.tsv`: las 3 tablas en texto separado por tabuladores. InDesign las convierte en tabla con *Texto a tabla* o al colocarlas con importación de Excel/TSV.

El texto es el original, sin cambios. Solo se han eliminado párrafos vacíos y se han añadido marcadores `[TABLA · …]` y `[GRÁFICO · …]` donde van esos elementos.

## Estilos de párrafo
| Estilo | Uso | Nº |
|---|---|---|
| AN_Portada_Titulo / AN_Portada_Dato | Título y datos de convocatoria | 1 / 3 |
| AN_H1 | Secciones 1–6, «Resumen visual» y «ANEXO» | 8 |
| AN_Cuerpo / AN_Destacado / AN_Lista | Texto corrido, párrafo en negrita completa y viñetas | 12 / 1 / 7 |
| AN_Marcador | Dónde va una tabla o un gráfico | 5 |
| AN_Grafico_Titulo / AN_Pie_Grafico / AN_Aviso_Provisional | Textos de los gráficos de dificultad | 2 / 2 / 1 |
| AN_Tabla_Cabecera / AN_Tabla_Celda | Contenido de tablas | — |
| AN_Preg_Meta | «Pregunta N · Tema X» | 100 |
| AN_Preg_Enunciado | Enunciado | 100 |
| AN_Preg_Opcion / AN_Preg_Opcion_Correcta | Alternativas (la correcta lleva su propio estilo) | 200 / 100 |
| AN_Retro_Label / AN_Retro_Cuerpo | «Retroalimentación» y su texto | 100 / 319 |
| AN_Dificultad_Bajo / _Medio / _Alto | Nivel de dificultad | 72 / 22 / 6 |

**Estilo de carácter:** `AN_Negrita` para las negritas dentro de un párrafo.

## Datos que conviene confirmar con la academia
Detectados al cruzar las tablas del informe con el anexo. No se han corregido.
1. **Pregunta 87:** el anexo la marca como **Tema 1**, pero la tabla de temas la incluye en el **Tema 2** (que figura con 4 preguntas) y deja el Tema 1 sin número ni preguntas. Según el anexo: Tema 1 = 1 pregunta y Tema 2 = 3.
2. **Temas 17, 20 y 36:** no aparecen en la tabla de temas, aunque el texto dice que usa los 45 temas. Según el anexo tienen 0 preguntas.
3. **Decimales:** se mezclan punto y coma (p. ej. «33.7» y «48,7»).

Comprobado y correcto: 100 preguntas, 3 alternativas cada una, una correcta por pregunta; dificultad 72 baja / 22 media / 6 alta (coincide con el gráfico); 74 preguntas en los temas 1–26; las 9 preguntas con «ambas respuestas son correctas» (2, 13, 28, 35, 36, 70, 75, 79, 98).

## Pendiente
- Gráficos de dificultad: los del original son imágenes de matplotlib fuera de marca; hay que rehacerlos con la paleta corporativa.
- Formato (apaisado o vertical) y diseño de página.

## Maqueta visual (A4 vertical)
`maqueta/maqueta_vertical.pdf` (y su `.html`): 4 páginas de prueba: resumen ejecutivo, radiografía y tribunal, comparativa con gráficos de dificultad y 3 fichas del anexo.
- **Tipografías de sustitución:** Inter Display Black en lugar de Lovelo y Liberation Sans en lugar de Helvetica, porque ni Lovelo ni Helvetica están instaladas en el entorno. Hay que aplicar las originales en InDesign.
- **Logotipo:** es un marcador de texto («an» + ACADEMIA NACIONAL). Hay que sustituirlo por el logotipo real.
- **Dificultad:** se muestra con tonos de azul y amarillo corporativos, sin semáforo verde/rojo.
