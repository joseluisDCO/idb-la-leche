let posicionSeleccionada = null;
let turnoActual = 1;
let turnoEditandoActual = null;
let hayCambiosTurno = false;
let volverAltaAnimalARegistro = false;
let posicionesTurnoOriginales = [];
let ingresoEditandoId = null;
import { supabase } from './supabaseClient.js';

async function init() {
  console.log('App iniciada');

  const { data: posiciones, error: errorPosiciones } = await supabase
    .from('turnos_base_posiciones')
    .select('*')
    .order('numero_turno', { ascending: true })
    .order('posicion', { ascending: true })
    .order('lado', { ascending: true });

    if (errorPosiciones) {
    console.error('Error cargando posiciones:', errorPosiciones);
    return;
  }

  const ahora = new Date();
  const fechaHoy = ahora.toISOString().split('T')[0];
  const ordenoActual = ahora.getHours() < 12 ? 'MANANA' : 'TARDE';

  const { data: produccionesHoy, error: errorProducciones } = await supabase
    .from('produccion')
    .select('crotal, litros, ordeno')
    .eq('fecha', fechaHoy)
    .eq('ordeno', ordenoActual);

  if (errorProducciones) {
    console.error('Error cargando producciones:', errorProducciones);
    return;
  }
  const { data: animalesData, error: errorAnimales } = await supabase
    .from('animales')
    .select('crotal, estado');

  if (errorAnimales) {
    console.error('Error cargando animales:', errorAnimales);
    return;
  }
  const ayer = new Date();
  ayer.setDate(ayer.getDate() - 1);
  const fechaAyer = ayer.toISOString().split('T')[0];

  const { data: produccionAyer } = await supabase
    .from('produccion')
    .select('crotal, litros')
    .eq('fecha', fechaAyer)
    .eq('ordeno', ordenoActual);

  const { data: produccionHoy } = await supabase
    .from('produccion')
    .select('crotal, litros')
    .eq('fecha', fechaHoy)
    .eq('ordeno', ordenoActual);

     const mapaProduccionHoy = new Map(
    (produccionesHoy || []).map(p => [p.crotal, p])
  );

  const mapaProduccionAyer = new Map(
    (produccionAyer || []).map(p => [p.crotal, p])
  );

  const mapaAnimales = new Map(
  (animalesData || []).map(a => [a.crotal, a])
);
  const posicionesConEstado = posiciones.map(pos => {
    const litrosHoy = mapaProduccionHoy.get(pos.crotal)?.litros ?? null;
    const litrosAyer = mapaProduccionAyer.get(pos.crotal)?.litros ?? null;

    let diferenciaLitros = null;
    if (litrosHoy !== null && litrosAyer !== null) {
      diferenciaLitros = litrosHoy - litrosAyer;
    }

    return {
      ...pos,
      registrada: mapaProduccionHoy.has(pos.crotal),
      litrosRegistrados: litrosHoy,
      litrosAyer: litrosAyer,
      diferenciaLitros,
      estadoAnimal: mapaAnimales.get(pos.crotal)?.estado ?? null,
    };
  });
  const crotalesTurno = posicionesConEstado
    .filter(p => p.numero_turno === turnoActual)
    .map(p => p.crotal)
    .filter(Boolean);

  const sumaAyer = (produccionAyer || [])
    .filter(p => crotalesTurno.includes(p.crotal))
    .reduce((acc, p) => acc + (p.litros || 0), 0);

  const sumaHoy = (produccionHoy || [])
    .filter(p => crotalesTurno.includes(p.crotal))
    .reduce((acc, p) => acc + (p.litros || 0), 0);

  const porcentaje = sumaAyer > 0 ? (sumaHoy / sumaAyer) * 100 : 0;

  console.log('Antes de actualizar resumen');
  actualizarCantaras(sumaAyer, sumaHoy, porcentaje);
  console.log('Antes de renderGrid', posicionesConEstado);

  renderGrid(posicionesConEstado);
  console.log('Después de renderGrid');
}

function actualizarCantaras(sumaAyer, sumaHoy, porcentaje) {
  let porcentajeTexto = 0;
  let porcentajeBarra = 0;
  let porcentajeExceso = 0;

  if (sumaAyer > 0) {
    porcentajeTexto = porcentaje;
    porcentajeBarra = Math.max(0, Math.min(porcentaje, 100));
    porcentajeExceso = Math.max(0, Math.min(porcentaje - 100, 100));
  } else if (sumaHoy > 0) {
    porcentajeTexto = 100;
    porcentajeBarra = 100;
    porcentajeExceso = 0;
  }

  const ayerLinea = document.getElementById('resumen-ayer-linea');
  const hoyLitrosLinea = document.getElementById('resumen-hoy-litros-linea');
  const hoyPorcentaje = document.getElementById('resumen-hoy-porcentaje');
  const barraLeche = document.getElementById('barra-leche-fill');
  const barraExceso = document.getElementById('barra-exceso-fill');

  if (ayerLinea) {
    ayerLinea.textContent = `Ayer: ${sumaAyer.toFixed(2)} L`;
  }

  if (hoyLitrosLinea) {
    hoyLitrosLinea.textContent = `Hoy: ${sumaHoy.toFixed(2)} L`;
  }

  if (hoyPorcentaje) {
    hoyPorcentaje.textContent = `${porcentajeTexto.toFixed(0)}%`;

    hoyPorcentaje.classList.remove('porcentaje-rojo', 'porcentaje-verde', 'porcentaje-neutro');

    if (porcentajeTexto >= 100) {
      hoyPorcentaje.classList.add('porcentaje-verde');
    } else if (porcentajeTexto > 0) {
      hoyPorcentaje.classList.add('porcentaje-rojo');
    } else {
      hoyPorcentaje.classList.add('porcentaje-neutro');
    }
  }

  if (barraLeche) {
    barraLeche.style.width = `${porcentajeBarra}%`;
  }

  if (barraExceso) {
  if (porcentajeTexto > 100) {
    const posicionMarca = (100 / porcentajeTexto) * 100;
    barraExceso.style.display = 'block';
    barraExceso.style.left = `${posicionMarca}%`;
  } else {
    barraExceso.style.display = 'none';
  }
}
}

async function comprobarConexion() {
  console.log('Entrando en comprobarConexion');

  const estadoConexion = document.getElementById('estado-conexion');
  const textoConexion = document.getElementById('conexion-texto');
  const iconoConexion = document.getElementById('conexion-icono');
  
  // Estado inicial (checking)
  if (textoConexion) {
    textoConexion.textContent = 'Comprobando conexión...';
  }

  if (iconoConexion) {
    iconoConexion.className = 'led-conexion checking';
  }

  if (estadoConexion) {
    estadoConexion.classList.remove('conectado', 'desconectado');
  }

  try {
    const { error } = await supabase
      .from('animales')
      .select('id')
      .limit(1);

    console.log('Resultado query:', error);

    const hayError = !!error;

    // Texto
    if (textoConexion) {
      textoConexion.textContent = hayError ? 'No conectado' : 'Conectado';
    }

    // LED
    if (iconoConexion) {
      iconoConexion.className = hayError
        ? 'led-conexion error'
        : 'led-conexion ok';
    }

    // Cápsula
    if (estadoConexion) {
      estadoConexion.classList.remove('conectado', 'desconectado');
      estadoConexion.classList.add(hayError ? 'desconectado' : 'conectado');
    }

    return !hayError;

  } catch (e) {
    console.error('Error comprobando conexión:', e);

    if (estadoConexion) {
      estadoConexion.classList.remove('conectado');
      estadoConexion.classList.add('desconectado');
    }

    if (textoConexion) {
      textoConexion.textContent = 'Error conexión';
    }

    if (iconoConexion) {
      iconoConexion.className = 'led-conexion error';
    }

  }
}

function renderGrid(posiciones) {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';

  const turnoLabel = document.getElementById('turno-label');
  if (turnoLabel) {
    turnoLabel.textContent = `Turno ${turnoActual}`;
    console.log('Turno pintado:', turnoActual);
  }

  const posicionesTurno = posiciones.filter(p => p.numero_turno === turnoActual);
  const maxTurno = Math.max(...posiciones.map(p => p.numero_turno || 1), 1);

  const btnAnterior = document.getElementById('btn-anterior');
  if (btnAnterior) btnAnterior.disabled = turnoActual <= 1;

  const btnSiguiente = document.getElementById('btn-siguiente');
  if (btnSiguiente) btnSiguiente.disabled = turnoActual >= maxTurno;

  const izquierda = posicionesTurno
    .filter(p => p.lado === 'IZQUIERDA')
    .sort((a, b) => a.posicion - b.posicion);

  const derecha = posicionesTurno
    .filter(p => p.lado === 'DERECHA')
    .sort((a, b) => a.posicion - b.posicion);

  function pintarCelda(celda, posicion) {
    const diferencia = posicion?.diferenciaLitros;
    const litros = posicion?.litrosRegistrados;
    const crotal = posicion?.crotal;
    const estado = posicion?.estadoAnimal;

    const esNoProductivo = estado && estado !== 'PRODUCTIVO';

    const claseComparacion =
      diferencia > 0 ? ' mejor' :
      diferencia < 0 ? ' peor' :
      ' neutro';

    celda.className =
      'celda' +
      (!crotal ? ' vacia' : '') +
      (esNoProductivo ? ' no-productivo' : claseComparacion);

    if (!crotal) {
      celda.innerHTML = `<div class="celda-crotal">Vacía</div>`;
      return;
    }

    if (litros !== null && litros !== undefined) {
      const diffNum = diferencia !== null && diferencia !== undefined
        ? Number(diferencia)
        : 0;

      const signoDiff = diffNum > 0 ? '+' : '';
      const flecha = diffNum > 0 ? '▲' : diffNum < 0 ? '▼' : '•';
      const claseDiff = diffNum > 0 ? 'diff-mejor' : diffNum < 0 ? 'diff-peor' : 'diff-neutro';

      celda.innerHTML = `
        <div class="celda-crotal">
          <span class="ok-icon">&#10003;</span> ${crotal}
        </div>
        <div class="celda-litros">🪣 ${Number(litros).toFixed(2)} L</div>
        <div class="celda-diff ${claseDiff}">
          ${flecha} ${signoDiff}${diffNum.toFixed(2)} L
        </div>
      `;

      return;
    }

    let textoEstado = 'Pendiente';

    if (estado && estado !== 'PRODUCTIVO') {
      textoEstado =
        estado === 'SECADO_PREPARTO' ? 'Secado preparto' :
        estado === 'NO_PRODUCTIVO' ? 'No productivo' :
        estado === 'BAJA' ? 'Baja' :
        estado;
    }

    celda.innerHTML = `
      <div class="celda-crotal">${crotal}</div>
      <div class="celda-pendiente">${textoEstado}</div>
    `;
  }

 const maxPosicionesTurno = Math.max(
  ...posicionesTurno.map(p => Number(p.posicion) || 0),
  0
);

for (let posicion = 1; posicion <= maxPosicionesTurno; posicion++) {
  const fila = document.createElement('div');
  fila.className = 'fila';

  const posIzquierda = izquierda.find(p => Number(p.posicion) === posicion);
  const posDerecha = derecha.find(p => Number(p.posicion) === posicion);

  const celdaIzquierda = document.createElement('div');
  pintarCelda(celdaIzquierda, posIzquierda);
  celdaIzquierda.style.cursor = 'pointer';
  celdaIzquierda.onclick = () => {
    const pos = posIzquierda;

    if (pos?.estadoAnimal && pos.estadoAnimal !== 'PRODUCTIVO') {
      abrirAltaAnimalDirecto(pos);
    } else {
      abrirModal(pos);
    }
  };

  const celdaDerecha = document.createElement('div');
  pintarCelda(celdaDerecha, posDerecha);
  celdaDerecha.style.cursor = 'pointer';
  celdaDerecha.onclick = () => {
    const pos = posDerecha;

    if (pos?.estadoAnimal && pos.estadoAnimal !== 'PRODUCTIVO') {
      abrirAltaAnimalDirecto(pos);
    } else {
      abrirModal(pos);
    }
  };

  fila.appendChild(celdaIzquierda);
  fila.appendChild(celdaDerecha);
  grid.appendChild(fila);
}
}

function abrirModal(pos) {
    if (pos?.crotal && pos?.estadoAnimal && pos.estadoAnimal !== 'PRODUCTIVO') {
    alert('Solo se puede registrar producción para animales en estado Productivo');
    return;
  }
  posicionSeleccionada = pos;

  const modal = document.getElementById('modal');
  const inputCrotal = document.getElementById('modal-crotal');
  const inputLitros = document.getElementById('modal-litros');
  const selectOrdeno = document.getElementById('modal-ordeno');
  const hora = new Date().getHours();
  const ordenoAutomatico = hora < 12 ? 'MANANA' : 'TARDE';

selectOrdeno.value = ordenoAutomatico;  
  inputCrotal.value = pos?.crotal || '';
  inputLitros.value = pos?.litrosRegistrados ?? '';

  modal.classList.remove('oculto');
}

function abrirAltaAnimalDirecto(pos) {
  if (!pos?.crotal) return;

  volverAltaAnimalARegistro = true;

  // Ocultar entorno ordeño
  const header = document.getElementById('header-ordeno');
  const nav = document.getElementById('navegacion-turnos');
  const grid = document.getElementById('grid');
  const resumen = document.getElementById('comparador-resumen');
  const panelTurno = document.getElementById('panel-turno-fijo');

  if (header) header.style.display = 'none';
  if (nav) nav.style.display = 'none';
  if (grid) grid.style.display = 'none';
  if (resumen) resumen.style.display = 'none';
  if (panelTurno) panelTurno.style.display = 'none';

  // Mostrar pantalla animal
  const pantallaAlta = document.getElementById('pantalla-alta-animal');
  if (pantallaAlta) pantallaAlta.style.display = 'block';
  mostrarModoAnimal('modificar');

  // 🔥 Rellenar directamente el crotal
  const inputCrotalEstado = document.getElementById('input-crotal-estado');
  if (inputCrotalEstado) inputCrotalEstado.value = pos.crotal;

  // Opcional: scroll automático a la zona de estado
  inputCrotalEstado?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cerrarModal() {
  const modal = document.getElementById('modal');
  modal.classList.add('oculto');
  posicionSeleccionada = null;
}
async function actualizarCrotalEnTurnoActivo(pos, nuevoCrotal) {
  const { error } = await supabase
    .from('turnos_activos_posiciones')
    .update({ crotal: nuevoCrotal })
    .eq('id', pos.id);

  if (error) {
    console.error('Error actualizando crotal en turno activo:', error);
    alert('Error al actualizar el crotal en el turno');
    return false;
  }

  return true;
}
async function guardarDesdeModal() {
  try {
    if (!posicionSeleccionada) return;
    if (
  posicionSeleccionada?.crotal &&
  posicionSeleccionada?.estadoAnimal &&
  posicionSeleccionada.estadoAnimal !== 'PRODUCTIVO'
) {
  alert('Solo se puede registrar producción para animales en estado Productivo');
  return;
}

    const inputCrotal = document.getElementById('modal-crotal');
    const inputLitros = document.getElementById('modal-litros');

    const crotal = inputCrotal.value.trim();
    const litros = parseFloat(inputLitros.value);
    const { data: animalValidado, error: errorAnimalValidado } = await supabase
      .from('animales')
      .select('crotal, estado')
      .eq('crotal', crotal)
      .single();

    if (errorAnimalValidado || !animalValidado) {
      alert('El crotal introducido no existe');
      return;
    }

if (animalValidado.estado !== 'PRODUCTIVO') {
  alert('Solo se puede registrar producción para animales en estado Productivo');
  return;
}

    if (!crotal) {
      alert('Introduce un crotal');
      return;
    }

    if (isNaN(litros)) {
      alert('Introduce litros válidos');
      return;
    }

    const ahora = new Date();
    const fecha = ahora.toISOString().split('T')[0];
    const horaTexto = ahora.toTimeString().split(' ')[0];
    const ordeno = ahora.getHours() < 12 ? 'MANANA' : 'TARDE';

    const { error } = await supabase.from('produccion').upsert({
      crotal,
      fecha,
      hora: horaTexto,
      ordeno,
      litros
    }, {
      onConflict: 'crotal,fecha,ordeno'
    });

    if (error) {
      console.error('Error guardando producción:', error);
      alert('Error al guardar la producción');
      return;
    }

    cerrarModal();
    await init();
  } catch (e) {
    console.error('Error inesperado en guardarDesdeModal:', e);
    alert('Ha ocurrido un error inesperado');
  }
}
const btnGuardar = document.getElementById('btn-guardar');
if (btnGuardar) btnGuardar.onclick = guardarDesdeModal;

const btnCancelar = document.getElementById('btn-cancelar');
if (btnCancelar) btnCancelar.onclick = cerrarModal;

const btnSiguiente = document.getElementById('btn-siguiente');
if (btnSiguiente) {
  btnSiguiente.onclick = () => {
    turnoActual++;
    init();
  };
}
const btnAnterior = document.getElementById('btn-anterior');
if (btnAnterior) {
  btnAnterior.onclick = () => {
    if (turnoActual > 1) {
      turnoActual--;
      init();
    }
  };
}

async function cargarCrotalesDisponibles() {
  const lista = document.getElementById('lista-crotales');
  if (!lista) return;

  const { data, error } = await supabase
    .from('animales')
    .select('crotal, estado')
    .neq('estado', 'BAJA')
    .order('crotal', { ascending: true });

  if (error) {
    console.error('Error cargando crotales para turnos:', error);
    return;
  }

  lista.innerHTML = '';

  (data || []).forEach(animal => {
    const option = document.createElement('option');
    option.value = animal.crotal;
    lista.appendChild(option);
  });

  console.log('Opciones cargadas:', lista.children.length);
}

function generarGridTurnoEdicion() {
  const grid = document.getElementById('grid-turno-edicion');
  const inputPosiciones = document.getElementById('input-posiciones-turno');

  if (!grid || !inputPosiciones) return;

  let numeroPosiciones = parseInt(inputPosiciones.value, 10);

  if (!numeroPosiciones || numeroPosiciones < 1) {
    numeroPosiciones = 1;
  }

  if (numeroPosiciones > 12) {
    numeroPosiciones = 12;
    inputPosiciones.value = '12';
  }

  grid.innerHTML = '';

  for (let i = 1; i <= numeroPosiciones; i++) {
    const fila = document.createElement('div');
    fila.className = 'fila';

    const inputIzq = document.createElement('input');
    inputIzq.id = `turno-izq-${i}`;
    inputIzq.type = 'text';
    inputIzq.setAttribute('list', 'lista-crotales');
    inputIzq.placeholder = `Izq ${i}`;

    const inputDer = document.createElement('input');
    inputDer.id = `turno-der-${i}`;
    inputDer.type = 'text';
    inputDer.setAttribute('list', 'lista-crotales');
    inputDer.placeholder = `Der ${i}`;

    fila.appendChild(inputIzq);
    fila.appendChild(inputDer);
    grid.appendChild(fila);
  }
}

async function guardarTurnoBase() {
  console.log('Entrando en guardarTurnoBase');

  const inputNumeroTurno = document.getElementById('input-numero-turno');
  const inputPosicionesTurno = document.getElementById('input-posiciones-turno');

  const numeroTurno = parseInt(inputNumeroTurno?.value, 10);
  const numeroPosiciones = parseInt(inputPosicionesTurno?.value, 10);

  if (!numeroTurno || numeroTurno < 1) {
    alert('Introduce un número de turno válido');
    return;
  }

  if (!numeroPosiciones || numeroPosiciones < 1 || numeroPosiciones > 12) {
    alert('Introduce un número de posiciones válido entre 1 y 12');
    return;
  }

  const { data: animalesValidos, error: errorAnimales } = await supabase
    .from('animales')
    .select('crotal, estado')
    .neq('estado', 'BAJA');

  const { data: turnosExistentes, error: errorTurnosExistentes } = await supabase
    .from('turnos_base_posiciones')
    .select('crotal, numero_turno');

  if (errorTurnosExistentes) {
    console.error('Error comprobando crotales ya asignados:', errorTurnosExistentes);
    alert('No se pudieron comprobar los turnos existentes');
    return;
  }

  const turnoYaExiste = (turnosExistentes || []).some(
    t => t.numero_turno === numeroTurno
  );

  if (turnoYaExiste) {
    alert(`El turno ${numeroTurno} ya existe`);
    return;
  }

  if (errorAnimales) {
    console.error('Error validando crotales:', errorAnimales);
    alert('No se pudieron validar los crotales');
    return;
  }

  const crotalesValidos = new Set((animalesValidos || []).map(a => a.crotal));
  const crotalesUsadosEnFormulario = new Set();
  const posicionesParaGuardar = [];

  for (let posicion = 1; posicion <= numeroPosiciones; posicion++) {
    const campos = [
      ['IZQUIERDA', `turno-izq-${posicion}`],
      ['DERECHA', `turno-der-${posicion}`]
    ];

    for (const [lado, inputId] of campos) {
      const valor = document.getElementById(inputId)?.value.trim() || '';

      if (valor && !crotalesValidos.has(valor)) {
        alert(`El crotal ${valor} no existe o está en Baja`);
        return;
      }

      if (valor && crotalesUsadosEnFormulario.has(valor)) {
        alert(`El crotal ${valor} está repetido en este turno`);
        return;
      }

      if (valor) {
        const turnoExistente = (turnosExistentes || []).find(t => t.crotal === valor);

        if (turnoExistente) {
          alert(`El crotal ${valor} ya está asignado al turno ${turnoExistente.numero_turno}`);
          return;
        }

        crotalesUsadosEnFormulario.add(valor);
      }

      posicionesParaGuardar.push({
        numero_turno: numeroTurno,
        lado,
        posicion,
        crotal: valor || null
      });
    }
  }

  const { error: errorInsert } = await supabase
    .from('turnos_base_posiciones')
    .insert(posicionesParaGuardar);

  if (errorInsert) {
    console.error('Error guardando turno:', errorInsert);
    alert('No se pudo guardar el turno');
    return;
  }

  alert(`Turno ${numeroTurno} guardado correctamente`);

  generarGridTurnoEdicion();

  await cargarInfoTurnosCreados();
}

async function cargarInfoTurnosCreados() {
  const infoTurnos = document.getElementById('info-turnos-creados');
  const inputNumeroTurno = document.getElementById('input-numero-turno');

  const { data, error } = await supabase
    .from('turnos_base_posiciones')
    .select('numero_turno');

  if (error) {
    console.error('Error cargando turnos creados:', error);
    if (infoTurnos) infoTurnos.textContent = 'No se pudieron cargar los turnos';
    return;
  }

  const turnosUnicos = [...new Set((data || []).map(t => t.numero_turno))].sort((a, b) => a - b);

  if (infoTurnos) {
    infoTurnos.textContent = turnosUnicos.length
      ? `Turnos creados: ${turnosUnicos.join(', ')}`
      : 'No hay turnos creados';
  }

  const siguienteTurno = turnosUnicos.length
    ? Math.max(...turnosUnicos) + 1
    : 1;

  if (inputNumeroTurno) {
    inputNumeroTurno.value = String(siguienteTurno);
  }
}

async function cargarTurnosParaActualizar() {
  const infoTurnos = document.getElementById('info-turnos-actualizar');
  const selectTurno = document.getElementById('select-turno-editar');

  const { data, error } = await supabase
    .from('turnos_base_posiciones')
    .select('numero_turno');

  if (error) {
    console.error('Error cargando turnos para actualizar:', error);
    if (infoTurnos) infoTurnos.textContent = 'No se pudieron cargar los turnos';
    return;
  }

  const turnosUnicos = [...new Set((data || []).map(t => t.numero_turno))].sort((a, b) => a - b);

  if (infoTurnos) {
    infoTurnos.textContent = turnosUnicos.length
      ? `Turnos creados: ${turnosUnicos.join(', ')}`
      : 'No hay turnos creados';
  }

   if (selectTurno) {
    selectTurno.innerHTML = '';

    turnosUnicos.forEach(turno => {
      const option = document.createElement('option');
      option.value = String(turno);
      option.textContent = `Turno ${turno}`;
      selectTurno.appendChild(option);
    });

    if (turnosUnicos.length > 0) {
  selectTurno.value = String(turnosUnicos[0]);
  await cargarTurnoEnEdicion(turnosUnicos[0]);
  turnoEditandoActual = turnosUnicos[0];
  hayCambiosTurno = false;
}
  }
}

function generarGridTurnoActualizar(numeroPosiciones, posicionesExistentes = [], conservarValoresActuales = false) {
  const grid = document.getElementById('grid-turno-actualizar');
  const inputPosiciones = document.getElementById('input-posiciones-turno-editar');

  if (!grid || !inputPosiciones) return;

  let totalPosiciones = parseInt(numeroPosiciones ?? inputPosiciones.value, 10);

  if (!totalPosiciones || totalPosiciones < 1) {
    totalPosiciones = 1;
  }

  if (totalPosiciones > 12) {
    totalPosiciones = 12;
    inputPosiciones.value = '12';
  }

  const valoresActuales = new Map();

  if (conservarValoresActuales) {
    grid.querySelectorAll('input[id^="edit-turno-"]').forEach(input => {
      valoresActuales.set(input.id, input.value.trim());
    });
  }

  grid.innerHTML = '';

  for (let posicion = 1; posicion <= totalPosiciones; posicion++) {
    const fila = document.createElement('div');
    fila.className = 'fila';

    const posIzq = (posicionesExistentes || []).find(
      p => p.lado === 'IZQUIERDA' && Number(p.posicion) === posicion
    );

    const posDer = (posicionesExistentes || []).find(
      p => p.lado === 'DERECHA' && Number(p.posicion) === posicion
    );

    const inputIzq = document.createElement('input');
    inputIzq.id = `edit-turno-izq-${posicion}`;
    inputIzq.type = 'text';
    inputIzq.setAttribute('list', 'lista-crotales');
    inputIzq.placeholder = `Izq ${posicion}`;
    inputIzq.value =
      conservarValoresActuales && valoresActuales.has(inputIzq.id)
        ? valoresActuales.get(inputIzq.id)
        : (posIzq?.crotal || '');

    const inputDer = document.createElement('input');
    inputDer.id = `edit-turno-der-${posicion}`;
    inputDer.type = 'text';
    inputDer.setAttribute('list', 'lista-crotales');
    inputDer.placeholder = `Der ${posicion}`;
    inputDer.value =
      conservarValoresActuales && valoresActuales.has(inputDer.id)
        ? valoresActuales.get(inputDer.id)
        : (posDer?.crotal || '');

    inputIzq.oninput = () => {
      hayCambiosTurno = true;
    };

    inputDer.oninput = () => {
      hayCambiosTurno = true;
    };

    fila.appendChild(inputIzq);
    fila.appendChild(inputDer);
    grid.appendChild(fila);
  }
}

async function cargarTurnoEnEdicion(numeroTurno) {
  const inputPosicionesEditar = document.getElementById('input-posiciones-turno-editar');

  const { data, error } = await supabase
    .from('turnos_base_posiciones')
    .select('lado, posicion, crotal')
    .eq('numero_turno', numeroTurno);

  if (error) {
    console.error('Error cargando turno para edición:', error);
    alert('No se pudo cargar el turno');
    return;
  }

  posicionesTurnoOriginales = data || [];

  const maxPosiciones = Math.max(
    ...posicionesTurnoOriginales.map(p => Number(p.posicion) || 0),
    1
  );

  if (inputPosicionesEditar) {
    inputPosicionesEditar.value = String(maxPosiciones);
  }

  generarGridTurnoActualizar(maxPosiciones, posicionesTurnoOriginales);
  activarSeguimientoCambiosTurno();
}

function activarSeguimientoCambiosTurno() {
  const inputsTurno = document.querySelectorAll('#grid-turno-actualizar input');

  inputsTurno.forEach(input => {
    input.oninput = () => {
      hayCambiosTurno = true;
    };
  });

  const inputPosiciones = document.getElementById('input-posiciones-turno-editar');

  if (inputPosiciones) {
    inputPosiciones.oninput = () => {
      hayCambiosTurno = true;
      generarGridTurnoActualizar(undefined, posicionesTurnoOriginales, true);
    };
  }
}

async function guardarCambiosTurno() {
  if (!turnoEditandoActual) {
    alert('No hay turno seleccionado');
    return;
  }

  const inputPosicionesEditar = document.getElementById('input-posiciones-turno-editar');
  const numeroPosiciones = parseInt(inputPosicionesEditar?.value, 10);

  if (!numeroPosiciones || numeroPosiciones < 1 || numeroPosiciones > 12) {
    alert('Introduce un número de posiciones válido entre 1 y 12');
    return;
  }

  const posicionesEliminadasConCrotal = (posicionesTurnoOriginales || []).filter(
    p => Number(p.posicion) > numeroPosiciones && p.crotal
  );

  if (posicionesEliminadasConCrotal.length > 0) {
    const continuar = confirm(
      `Vas a reducir el turno y se eliminarán ${posicionesEliminadasConCrotal.length} posiciones con crotal asignado. ¿Quieres continuar?`
    );

    if (!continuar) {
      return;
    }
  }

  const { data: animalesValidos, error: errorAnimales } = await supabase
    .from('animales')
    .select('crotal, estado')
    .neq('estado', 'BAJA');

  if (errorAnimales) {
    console.error('Error validando crotales:', errorAnimales);
    alert('No se pudieron validar los crotales');
    return;
  }

  const { data: turnosExistentes, error: errorTurnosExistentes } = await supabase
    .from('turnos_base_posiciones')
    .select('crotal, numero_turno');

  if (errorTurnosExistentes) {
    console.error('Error comprobando turnos existentes:', errorTurnosExistentes);
    alert('No se pudieron comprobar los turnos existentes');
    return;
  }

  const crotalesValidos = new Set((animalesValidos || []).map(a => a.crotal));
  const crotalesUsados = new Set();
  const posicionesParaGuardar = [];

  for (let posicion = 1; posicion <= numeroPosiciones; posicion++) {
    const campos = [
      ['IZQUIERDA', `edit-turno-izq-${posicion}`],
      ['DERECHA', `edit-turno-der-${posicion}`]
    ];

    for (const [lado, inputId] of campos) {
      const valor = document.getElementById(inputId)?.value.trim() || '';

      if (valor && !crotalesValidos.has(valor)) {
        alert(`El crotal ${valor} no existe o está en Baja`);
        return;
      }

      if (valor && crotalesUsados.has(valor)) {
        alert(`El crotal ${valor} está repetido en este turno`);
        return;
      }

      if (valor) {
        const turnoExistente = (turnosExistentes || []).find(
          t => t.crotal === valor && t.numero_turno !== turnoEditandoActual
        );

        if (turnoExistente) {
          alert(`El crotal ${valor} ya está en el turno ${turnoExistente.numero_turno}`);
          return;
        }

        crotalesUsados.add(valor);
      }

      posicionesParaGuardar.push({
        numero_turno: turnoEditandoActual,
        lado,
        posicion,
        crotal: valor || null
      });
    }
  }

  const { error: errorDelete } = await supabase
    .from('turnos_base_posiciones')
    .delete()
    .eq('numero_turno', turnoEditandoActual);

  if (errorDelete) {
    console.error('Error eliminando turno previo:', errorDelete);
    alert('Error eliminando turno previo');
    return;
  }

  const { error: errorInsert } = await supabase
    .from('turnos_base_posiciones')
    .insert(posicionesParaGuardar);

  if (errorInsert) {
    console.error('Error guardando cambios:', errorInsert);
    alert('Error guardando cambios');
    return;
  }

  alert('Turno actualizado correctamente');

  posicionesTurnoOriginales = posicionesParaGuardar;
  hayCambiosTurno = false;

  await cargarTurnoEnEdicion(turnoEditandoActual);
}

async function eliminarTurno() {
  if (!turnoEditandoActual) {
    alert('No hay turno seleccionado');
    return;
  }

  const confirmar = confirm(`¿Seguro que quieres eliminar el turno ${turnoEditandoActual}?`);
  if (!confirmar) {
    return;
  }

  const { error } = await supabase
    .from('turnos_base_posiciones')
    .delete()
    .eq('numero_turno', turnoEditandoActual);

  if (error) {
    console.error('Error eliminando turno:', error);
    alert('No se pudo eliminar el turno');
    return;
  }

  alert(`Turno ${turnoEditandoActual} eliminado correctamente`);

  turnoEditandoActual = null;
  hayCambiosTurno = false;

  await cargarTurnosParaActualizar();
}

function inicializarFechasPorDefecto() {
  const hoy = new Date();

  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const formato = (fecha) => fecha.toISOString().split('T')[0];

  const inputDesde = document.getElementById('filtro-fecha-desde');
  const inputHasta = document.getElementById('filtro-fecha-hasta');

  if (inputDesde) inputDesde.value = formato(desde);
  if (inputHasta) inputHasta.value = formato(hoy);
}

async function buscarProduccionPorFecha() {
  const desde = document.getElementById('filtro-fecha-desde')?.value;
  const hasta = document.getElementById('filtro-fecha-hasta')?.value;
  const contenedor = document.getElementById('resultado-produccion-fecha');

  if (!desde || !hasta) {
    alert('Selecciona fechas válidas');
    return;
  }

  const { data, error } = await supabase
    .from('produccion') // ajusta si tu tabla se llama distinto
    .select('fecha, litros')
    .gte('fecha', desde)
    .lte('fecha', hasta);

  if (error) {
    console.error(error);
    alert('Error cargando datos');
    return;
  }

  // Agrupar por fecha
  const resumen = {};

  (data || []).forEach(reg => {
    const fecha = reg.fecha;
    const litros = parseFloat(reg.litros) || 0;

    if (!resumen[fecha]) {
      resumen[fecha] = 0;
    }

    resumen[fecha] += litros;
  });

  // Ordenar fechas
  const fechasOrdenadas = Object.keys(resumen).sort();

  // Pintar resultado
  contenedor.innerHTML = '';

  if (fechasOrdenadas.length === 0) {
    contenedor.textContent = 'Sin datos en ese periodo';
    return;
  }

  fechasOrdenadas.forEach(fecha => {
    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.background = '#fff';
    div.style.border = '1px solid #ddd';
    div.style.borderRadius = '8px';
    div.style.marginBottom = '8px';

    div.textContent = `${fecha} → ${resumen[fecha].toFixed(2)} L`;

    contenedor.appendChild(div);
  });
}

function inicializarFechasPorDefectoAnimal() {
  const hoy = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const formato = (f) => f.toISOString().split('T')[0];

  const inputDesde = document.getElementById('filtro-animal-desde');
  const inputHasta = document.getElementById('filtro-animal-hasta');

  if (inputDesde) inputDesde.value = formato(desde);
  if (inputHasta) inputHasta.value = formato(hoy);
}

async function buscarProduccionPorAnimal() {
  const desde = document.getElementById('filtro-animal-desde')?.value;
  const hasta = document.getElementById('filtro-animal-hasta')?.value;
  const contenedor = document.getElementById('resultado-produccion-animal');

  if (!desde || !hasta) {
    alert('Selecciona fechas válidas');
    return;
  }

  const { data, error } = await supabase
    .from('produccion')
    .select('crotal, fecha, litros')
    .gte('fecha', desde)
    .lte('fecha', hasta);

  if (error) {
    console.error('Error cargando producción por animal:', error);
    alert('Error cargando datos');
    return;
  }

  const resumen = {};

  (data || []).forEach(reg => {
    const crotal = reg.crotal;
    const litros = parseFloat(reg.litros) || 0;
    const fecha = reg.fecha;

    if (!resumen[crotal]) {
      resumen[crotal] = {
        crotal,
        total: 0,
        fechas: new Set()
      };
    }

    resumen[crotal].total += litros;
    resumen[crotal].fechas.add(fecha);
  });

  const resultado = Object.values(resumen)
    .map(item => ({
      crotal: item.crotal,
      total: item.total,
      media: item.fechas.size > 0 ? item.total / item.fechas.size : 0
    }))
    .sort((a, b) => b.total - a.total);

  contenedor.innerHTML = '';

  if (resultado.length === 0) {
    contenedor.textContent = 'Sin datos en ese periodo';
    return;
  }

  resultado.forEach(item => {
    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.background = '#fff';
    div.style.border = '1px solid #ddd';
    div.style.borderRadius = '8px';
    div.style.marginBottom = '8px';

    div.textContent = `${item.crotal} → Total: ${item.total.toFixed(2)} L | Media: ${item.media.toFixed(2)} L`;

    contenedor.appendChild(div);
  });
}

function exportarProduccionAnimalCSV() {
  const resultado = document.getElementById('resultado-produccion-animal');

  if (!resultado || !resultado.children.length) {
    alert('No hay datos para exportar');
    return;
  }

  const filas = [['Crotal', 'Total Litros', 'Media Litros']];

  Array.from(resultado.children).forEach(div => {
    const texto = div.textContent || '';

    // Formato actual:
    // 1001 → Total: 120.00 L | Media: 15.00 L

    const partes = texto.split('→');
    if (partes.length !== 2) return;

    const crotal = partes[0].trim();

    const datos = partes[1].split('|');

    const total = datos[0]?.replace('Total:', '').replace('L', '').trim();
    const media = datos[1]?.replace('Media:', '').replace('L', '').trim();

    filas.push([crotal, total, media]);
  });

  const csv = filas.map(fila => fila.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'produccion_por_animal.csv';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  URL.revokeObjectURL(url);
}

function exportarResultadoPDF(titulo, resultadoId) {
  const resultado = document.getElementById(resultadoId);

  if (!resultado || !resultado.children.length) {
    alert('No hay datos para exportar');
    return;
  }

  const contenido = Array.from(resultado.children)
    .map(div => `<div style="padding:8px; border-bottom:1px solid #ddd;">${div.textContent}</div>`)
    .join('');

  const ventana = window.open('', '_blank');

  ventana.document.write(`
    <html>
      <head>
        <title>${titulo}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { margin-bottom: 20px; }
          .fecha { color: #666; margin-bottom: 20px; }
          .acciones { margin-bottom: 20px; }
          button {
            padding: 10px 14px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            margin-right: 8px;
          }
          @media print {
            .acciones { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="acciones">
          <button onclick="window.print()">Imprimir / Guardar PDF</button>
          <button onclick="window.close()">Cerrar</button>
        </div>

        <h1>${titulo}</h1>
        <div class="fecha">Generado: ${new Date().toLocaleString()}</div>
        ${contenido}
      </body>
    </html>
  `);

  ventana.document.close();
}

function exportarAnimalesCSV() {
  const resultado = document.getElementById('resultado-informe-animales');

  if (!resultado || !resultado.children.length) {
    alert('No hay datos para exportar');
    return;
  }

  const filas = [['Crotal', 'Estado']];

  Array.from(resultado.children).forEach(div => {
    const texto = div.textContent || '';
    const partes = texto.split('→');

    if (partes.length === 2) {
      filas.push([partes[0].trim(), partes[1].trim()]);
    }
  });

  const csv = filas.map(fila => fila.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'informe_animales.csv';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  URL.revokeObjectURL(url);
}

function inicializarMesesGraficoProduccion() {
  const hoy = new Date();

  const mesActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;

  const mesAnteriorFecha = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
  const mesAnterior = `${mesAnteriorFecha.getFullYear()}-${String(mesAnteriorFecha.getMonth() + 1).padStart(2, '0')}`;

  const inputBase = document.getElementById('grafico-mes-base');
  const inputComparacion = document.getElementById('grafico-mes-comparacion');

  if (inputBase) inputBase.value = mesActual;
  if (inputComparacion) inputComparacion.value = mesAnterior;
}

async function pintarGraficoProduccionFecha() {
  const canvas = document.getElementById('grafico-produccion-fecha');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

  const mesBase = document.getElementById('grafico-mes-base')?.value;
  const mesComparacion = document.getElementById('grafico-mes-comparacion')?.value;

  if (!mesBase || !mesComparacion) return;

  const inicioBase = `${mesBase}-01`;
  const finBase = new Date(mesBase.split('-')[0], mesBase.split('-')[1], 0)
    .toISOString().slice(0,10);

  const inicioComp = `${mesComparacion}-01`;
  const finComp = new Date(mesComparacion.split('-')[0], mesComparacion.split('-')[1], 0)
    .toISOString().slice(0,10);

  const { data: dataBase } = await supabase
    .from('produccion')
    .select('fecha, litros')
    .gte('fecha', inicioBase)
    .lte('fecha', finBase);

  const { data: dataComp } = await supabase
    .from('produccion')
    .select('fecha, litros')
    .gte('fecha', inicioComp)
    .lte('fecha', finComp);

  const agrupar = (data) => {
    const mapa = {};
    (data || []).forEach(r => {
      const dia = r.fecha.slice(8,10);
      mapa[dia] = (mapa[dia] || 0) + Number(r.litros || 0);
    });
    return mapa;
  };

  const baseMap = agrupar(dataBase);
  const compMap = agrupar(dataComp);

  const dias = Array.from({ length: 31 }, (_, i) => String(i+1).padStart(2,'0'));

  const baseValores = dias.map(d => baseMap[d] || 0);
  const compValores = dias.map(d => compMap[d] || 0);

  // limpiar
ctx.clearRect(0, 0, canvas.width, canvas.height);

const w = canvas.width;
const h = canvas.height;
const padding = 28;
const chartW = w - padding * 2;
const chartH = h - padding * 2;

const max = Math.max(...baseValores, ...compValores, 1);
const barGroupWidth = chartW / dias.length;
const barWidth = Math.max(3, barGroupWidth * 0.36);

// Fondo
ctx.fillStyle = '#ffffff';
ctx.fillRect(0, 0, w, h);

// Ejes suaves
ctx.strokeStyle = '#D7EAF5';
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(padding, padding);
ctx.lineTo(padding, h - padding);
ctx.lineTo(w - padding, h - padding);
ctx.stroke();

// Barras
dias.forEach((dia, i) => {
  const base = baseValores[i];
  const comp = compValores[i];

  const xCentro = padding + i * barGroupWidth + barGroupWidth / 2;

  const baseH = (base / max) * chartH;
  const compH = (comp / max) * chartH;

  const yBase = h - padding - baseH;
  const yComp = h - padding - compH;

  // Mes base azul
  ctx.fillStyle = '#2F8FC6';
  ctx.fillRect(xCentro - barWidth, yBase, barWidth, baseH);

  // Mes comparación naranja
  ctx.fillStyle = '#FF7A00';
  ctx.fillRect(xCentro + 1, yComp, barWidth, compH);
});

// Etiquetas cada 5 días
ctx.fillStyle = '#6B8394';
ctx.font = '10px Arial';
ctx.textAlign = 'center';

dias.forEach((dia, i) => {
  if (i % 5 === 0 || dia === '31') {
    const x = padding + i * barGroupWidth + barGroupWidth / 2;
    ctx.fillText(String(i + 1), x, h - 8);
  }
});

// Leyenda
ctx.textAlign = 'left';
ctx.font = '12px Arial';

ctx.fillStyle = '#2F8FC6';
ctx.fillRect(padding, 8, 10, 10);
ctx.fillStyle = '#183243';
ctx.fillText(`Mes base: ${mesBase}`, padding + 16, 17);

ctx.fillStyle = '#FF7A00';
ctx.fillRect(padding + 150, 8, 10, 10);
ctx.fillStyle = '#183243';
ctx.fillText(`Comparación: ${mesComparacion}`, padding + 166, 17);
}

async function pintarGraficoTopAnimales() {
  const canvas = document.getElementById('grafico-top-animales');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');

  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;

  const desde = document.getElementById('filtro-animal-desde')?.value;
  const hasta = document.getElementById('filtro-animal-hasta')?.value;

  if (!desde || !hasta) return;

  const { data, error } = await supabase
    .from('produccion')
    .select('crotal, litros')
    .gte('fecha', desde)
    .lte('fecha', hasta);

  if (error) {
    console.error('Error cargando producción top animales:', error);
    return;
  }

  const mapa = {};

  (data || []).forEach(r => {
    mapa[r.crotal] = (mapa[r.crotal] || 0) + Number(r.litros || 0);
  });

  const top = Object.entries(mapa)
    .map(([crotal, litros]) => ({ crotal, litros }))
    .sort((a, b) => b.litros - a.litros)
    .slice(0, 5);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const w = canvas.width;
  const h = canvas.height;
  const padding = 34;
  const chartW = w - padding * 2;
  const chartH = h - padding * 2;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = '#183243';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Top 5 producción acumulada', padding, 20);

  if (top.length === 0) {
    ctx.font = '13px Arial';
    ctx.fillStyle = '#6B8394';
    ctx.fillText('Sin datos en el periodo seleccionado', padding, 55);
    return;
  }

  const max = Math.max(...top.map(t => t.litros), 1);
  const gap = chartH / top.length;
  const barHeight = Math.max(18, gap * 0.48);
  const colores = ['#0E4D74', '#2F8FC6', '#6FAED6', '#8ED8FF', '#BFEAFF'];

  top.forEach((item, i) => {
    const y = padding + 18 + i * gap;
    const ancho = Math.max(4, (item.litros / max) * chartW);

    ctx.fillStyle = 'rgba(23,71,102,0.10)';
    ctx.fillRect(padding + 3, y + 4, ancho, barHeight);

    ctx.fillStyle = colores[i] || '#2F8FC6';
    ctx.fillRect(padding, y, ancho, barHeight);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'left';

    // Texto dentro de la barra (crotal + ranking)
    ctx.fillText(`#${i + 1} · ${item.crotal}`, padding + 6, y + barHeight / 2 + 4);

    ctx.fillStyle = '#183243';
    ctx.font = 'bold 12px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';

    // Evita que se salga si la barra es pequeña
    const posTexto = Math.max(padding + ancho - 6, padding + 80);

ctx.fillText(`${item.litros.toFixed(1)} L`, posTexto, y + barHeight / 2 + 4);
    ctx.strokeStyle = '#EAF6FF';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, y + barHeight + 8);
    ctx.lineTo(w - padding, y + barHeight + 8);
    ctx.stroke();
  });

  ctx.textAlign = 'left';
}

function inicializarFechasAnimalMesActual() {
  const hoy = new Date();

  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta = hoy;

  const fDesde = document.getElementById('filtro-animal-desde');
  const fHasta = document.getElementById('filtro-animal-hasta');

  if (fDesde) fDesde.value = desde.toISOString().slice(0, 10);
  if (fHasta) fHasta.value = hasta.toISOString().slice(0, 10);
}

function mostrarModoAnimal(modo) {
  const bloqueAlta = document.getElementById('bloque-alta-animal');
  const bloqueModificar = document.getElementById('bloque-modificar-animal');
  const btnAlta = document.getElementById('btn-modo-alta-animal');
  const btnModificar = document.getElementById('btn-modo-modificar-animal');
  const tituloAnimal = document.getElementById('titulo-animal');

  const esAlta = modo === 'alta';

  if (bloqueAlta) bloqueAlta.style.display = esAlta ? 'flex' : 'none';
  if (bloqueModificar) bloqueModificar.style.display = esAlta ? 'none' : 'flex';

  if (btnAlta) btnAlta.classList.toggle('activo', esAlta);
  if (btnModificar) btnModificar.classList.toggle('activo', !esAlta);

  if (tituloAnimal) {
    tituloAnimal.textContent = esAlta ? 'Alta de Animal' : 'Modificar estado';
  }
}

function inicializarFechasIngresoEconomico() {
  const hoy = new Date();
  const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);

  const formato = (fecha) => fecha.toISOString().split('T')[0];

  const desde = document.getElementById('ingreso-periodo-desde');
  const hasta = document.getElementById('ingreso-periodo-hasta');

  if (desde && !desde.value) desde.value = formato(primerDiaMes);
  if (hasta && !hasta.value) hasta.value = formato(hoy);
}

function parsearNumeroES(valor) {
  if (valor === '' || valor === null || valor === undefined) {
    return null;
  }

  const limpio = String(valor)
    .trim()
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.');

  const numero = Number(limpio);

  return Number.isFinite(numero) ? numero : null;
}

function leerNumeroIngreso(id) {
  const valor = document.getElementById(id)?.value;
  return parsearNumeroES(valor);
}

function formatearNumeroES(valor, decimales = 2) {
  const numero = typeof valor === 'number'
    ? valor
    : parsearNumeroES(valor);

  if (numero === null) {
    return '';
  }

  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales
  }).format(numero);
}

function activarFormatoCamposIngreso() {
  const campos = [
    { id: 'ingreso-litros-recogidos', decimales: 2 },
    { id: 'ingreso-grasas', decimales: 4 },
    { id: 'ingreso-perdidas', decimales: 2 },
    { id: 'ingreso-litros-pagados', decimales: 2 },
    { id: 'ingreso-precio-base', decimales: 4 },
    { id: 'ingreso-precio-final', decimales: 4 },
    { id: 'ingreso-importe-total', decimales: 2 }
  ];

  campos.forEach(({ id, decimales }) => {
    const input = document.getElementById(id);
    if (!input) return;

    if (input.dataset.formatoIngresoActivado === '1') return;
    input.dataset.formatoIngresoActivado = '1';

    input.addEventListener('blur', () => {
      if (input.value.trim() !== '') {
        input.value = formatearNumeroES(input.value, decimales);
      }
    });

    input.addEventListener('focus', () => {
      const numero = parsearNumeroES(input.value);
      if (numero !== null) {
        input.value = String(numero).replace('.', ',');
      }
    });
  });
}

async function guardarIngresoEconomico() {
  const mensaje = document.getElementById('mensaje-ingreso');

  const periodoDesde = document.getElementById('ingreso-periodo-desde')?.value;
  const periodoHasta = document.getElementById('ingreso-periodo-hasta')?.value;

  if (!periodoDesde || !periodoHasta) {
    alert('Selecciona el periodo de ingreso');
    return;
  }

  if (periodoHasta < periodoDesde) {
    alert('La fecha hasta no puede ser anterior a la fecha desde');
    return;
  }

  const nuevoIngreso = {
    periodo_desde: periodoDesde,
    periodo_hasta: periodoHasta,
    litros_recogidos: leerNumeroIngreso('ingreso-litros-recogidos'),
    grasas: leerNumeroIngreso('ingreso-grasas'),
    perdidas: leerNumeroIngreso('ingreso-perdidas'),
    litros_pagados: leerNumeroIngreso('ingreso-litros-pagados'),
    precio_base: leerNumeroIngreso('ingreso-precio-base'),
    precio_final: leerNumeroIngreso('ingreso-precio-final'),
    importe_total: leerNumeroIngreso('ingreso-importe-total')
  };

  let resultado;

  if (ingresoEditandoId) {
    resultado = await supabase
      .from('ingresos_economicos')
      .update(nuevoIngreso)
      .eq('id', ingresoEditandoId);
  } else {
    resultado = await supabase
      .from('ingresos_economicos')
      .insert(nuevoIngreso);
  }

const { error } = resultado;

  if (error) {
    console.error('Error guardando ingreso económico:', error);
    alert('No se pudo guardar el ingreso económico');
    return;
  }

  if (mensaje) {
    mensaje.textContent = 'Ingreso económico guardado correctamente';
  }

  alert('Ingreso económico guardado correctamente');
  ingresoEditandoId = null;

  const btnGuardar = document.getElementById('btn-guardar-ingreso');
  if (btnGuardar) {
    btnGuardar.textContent = 'Guardar ingreso económico';
  }
}

function mostrarModoIngreso(modo) {
  const bloqueNuevo = document.getElementById('bloque-ingreso-nuevo');
  const bloqueConsulta = document.getElementById('bloque-ingreso-consulta');
  const btnNuevo = document.getElementById('btn-modo-ingreso-nuevo');
  const btnConsulta = document.getElementById('btn-modo-ingreso-consulta');

  const periodoCard = document.querySelector('.ingreso-periodo-card:not(#ingreso-anio-card)');
  const anioCard = document.getElementById('ingreso-anio-card');
  const inputAnio = document.getElementById('ingreso-anio-consulta');

  const esNuevo = modo === 'nuevo';

  if (bloqueNuevo) bloqueNuevo.style.display = esNuevo ? 'block' : 'none';
  if (bloqueConsulta) bloqueConsulta.style.display = esNuevo ? 'none' : 'block';

  if (periodoCard) periodoCard.style.display = esNuevo ? 'block' : 'none';
  if (anioCard) anioCard.style.display = esNuevo ? 'none' : 'block';

  if (btnNuevo) btnNuevo.classList.toggle('activo', esNuevo);
  if (btnConsulta) btnConsulta.classList.toggle('activo', !esNuevo);

  if (!esNuevo) {
    if (inputAnio && !inputAnio.value) {
      inputAnio.value = String(new Date().getFullYear());
    }

    cargarIngresosAnuales();
  }
}

function formatearImporte(valor) {
  return `${formatearNumeroES(Number(valor || 0), 2)} €`;
}

function formatearLitros(valor) {
  return `${formatearNumeroES(Number(valor || 0), 2)} L`;
}

function formatearPrecio(valor) {
  if (valor === null || valor === undefined) return '-';
  return `${formatearNumeroES(Number(valor || 0), 4)} €`;
}

function formatearDecimal(valor, decimales = 2) {
  if (valor === null || valor === undefined) return '-';
  return formatearNumeroES(Number(valor || 0), decimales);
}

async function cargarIngresosAnuales() {
  const grid = document.getElementById('grid-ingresos-anuales');
  const detalle = document.getElementById('detalle-ingreso-mes');
  const inputAnio = document.getElementById('ingreso-anio-consulta');

  if (!grid) return;

  const anioSeleccionado = parseInt(inputAnio?.value, 10) || new Date().getFullYear();

  if (inputAnio && !inputAnio.value) {
    inputAnio.value = String(anioSeleccionado);
  }

  const desde = `${anioSeleccionado}-01-01`;
  const hasta = `${anioSeleccionado}-12-31`;

  const { data, error } = await supabase
    .from('ingresos_economicos')
    .select('*')
    .gte('periodo_hasta', desde)
    .lte('periodo_hasta', hasta)
    .order('periodo_hasta', { ascending: true });

  if (error) {
    console.error('Error cargando ingresos económicos:', error);
    alert('No se pudieron cargar los ingresos económicos');
    return;
  }

  const meses = [
    'Ene', 'Feb', 'Mar', 'Abr',
    'May', 'Jun', 'Jul', 'Ago',
    'Sep', 'Oct', 'Nov', 'Dic'
  ];

  const ingresosPorMes = Array.from({ length: 12 }, () => []);

  (data || []).forEach(ingreso => {
    if (!ingreso.periodo_hasta) return;

    const fechaHasta = new Date(`${ingreso.periodo_hasta}T00:00:00`);
    const mes = fechaHasta.getMonth();

    if (mes >= 0 && mes <= 11) {
      ingresosPorMes[mes].push(ingreso);
    }
  });

  grid.innerHTML = '';

  if (detalle) {
  detalle.innerHTML = '';
  detalle.style.display = 'none';
  }

  meses.forEach((nombreMes, index) => {
    const ingresosMes = ingresosPorMes[index];
    const importeMes = ingresosMes.reduce(
      (acc, item) => acc + Number(item.importe_total || 0),
      0
    );

    const card = document.createElement('div');
    card.className = 'mes-ingreso-card' + (ingresosMes.length ? '' : ' sin-datos');

    card.innerHTML = `
      <div class="mes-ingreso-nombre">${nombreMes}</div>
      <div class="mes-ingreso-importe">
        ${ingresosMes.length ? formatearImporte(importeMes) : 'Sin datos'}
      </div>
    `;

    card.onclick = () => {
      document.querySelectorAll('.mes-ingreso-card').forEach(c => {
        c.classList.remove('activo');
      });

      card.classList.add('activo');
      mostrarDetalleIngresoMes(nombreMes, anioSeleccionado, ingresosMes);
    };

    grid.appendChild(card);
  });
}

function mostrarDetalleIngresoMes(nombreMes, anio, ingresosMes) {
  const detalle = document.getElementById('detalle-ingreso-mes');
  if (!detalle) return;

  detalle.style.display = 'block';

  if (!ingresosMes || ingresosMes.length === 0) {
    detalle.innerHTML = `<strong>${nombreMes} ${anio}</strong><br>Sin ingresos registrados.`;
    return;
  }

  const bloques = ingresosMes.map(ingreso => `
    <div style="margin-bottom:12px;">
      <strong>${nombreMes} ${anio}</strong><br>
      Periodo: ${ingreso.periodo_desde || '-'} / ${ingreso.periodo_hasta || '-'}<br>
      Litros recogidos: ${formatearLitros(ingreso.litros_recogidos)}<br>
      Grasas: ${formatearDecimal ? formatearDecimal(ingreso.grasas, 4) : (ingreso.grasas ?? '-')}<br>
      Pérdidas: ${formatearDecimal ? formatearDecimal(ingreso.perdidas, 2) : (ingreso.perdidas ?? '-')}<br>
      Litros pagados: ${formatearLitros(ingreso.litros_pagados)}<br>
      Precio base: ${formatearPrecio ? formatearPrecio(ingreso.precio_base) : `${ingreso.precio_base ?? '-'} €`}<br>
      Precio final: ${formatearPrecio ? formatearPrecio(ingreso.precio_final) : `${ingreso.precio_final ?? '-'} €`}<br>
      Importe total: ${formatearImporte(ingreso.importe_total)}

      <button class="btn-modificar-ingreso" data-ingreso-id="${ingreso.id}">
        ✎ Modificar ingreso
      </button>
    </div>
  `).join('');

  detalle.innerHTML = bloques;

  detalle.querySelectorAll('.btn-modificar-ingreso').forEach(btn => {
    btn.onclick = () => {
      const id = Number(btn.dataset.ingresoId);
      const ingreso = ingresosMes.find(item => Number(item.id) === id);

      if (ingreso) {
        solicitarClaveYEditarIngreso(ingreso);
      }
    };
  });
}

function solicitarClaveYEditarIngreso(ingreso) {
  const clave = prompt('Introduce la clave para modificar el ingreso');

  if (clave !== '2301') {
    alert('Clave incorrecta');
    return;
  }

  ingresoEditandoId = ingreso.id;

  const periodoDesde = document.getElementById('ingreso-periodo-desde');
  const periodoHasta = document.getElementById('ingreso-periodo-hasta');

  if (periodoDesde) periodoDesde.value = ingreso.periodo_desde || '';
  if (periodoHasta) periodoHasta.value = ingreso.periodo_hasta || '';

  const asignarValor = (id, valor, decimales = 2) => {
    const input = document.getElementById(id);
    if (!input) return;

    if (valor === null || valor === undefined) {
      input.value = '';
      return;
    }

    if (typeof formatearNumeroES === 'function') {
      input.value = formatearNumeroES(Number(valor), decimales);
    } else {
      input.value = String(valor);
    }
  };

  asignarValor('ingreso-litros-recogidos', ingreso.litros_recogidos, 2);
  asignarValor('ingreso-grasas', ingreso.grasas, 4);
  asignarValor('ingreso-perdidas', ingreso.perdidas, 2);
  asignarValor('ingreso-litros-pagados', ingreso.litros_pagados, 2);
  asignarValor('ingreso-precio-base', ingreso.precio_base, 4);
  asignarValor('ingreso-precio-final', ingreso.precio_final, 4);
  asignarValor('ingreso-importe-total', ingreso.importe_total, 2);

  const btnGuardar = document.getElementById('btn-guardar-ingreso');
  if (btnGuardar) {
    btnGuardar.textContent = 'Guardar cambios del ingreso';
  }

  mostrarModoIngreso('nuevo');
}

async function arrancarApp() {
  await comprobarConexion();

  const btnRegistrar = document.getElementById('btn-registrar-ordeno');
  if (btnRegistrar) {
    btnRegistrar.onclick = () => {
      const pantallaInicio = document.getElementById('pantalla-inicio');
      if (pantallaInicio) pantallaInicio.style.display = 'none';

      const header = document.getElementById('header-ordeno');
      const nav = document.getElementById('navegacion-turnos');
      const grid = document.getElementById('grid');
      const resumen = document.getElementById('comparador-resumen');

      if (header) header.style.display = 'flex';
      if (nav) nav.style.display = 'flex';
      if (grid) grid.style.display = 'flex';
      if (resumen) resumen.style.display = 'flex';
      
   const panelTurno = document.getElementById('panel-turno-fijo');
    if (panelTurno) panelTurno.style.display = 'block';

    const bloqueOrdeno = document.getElementById('bloque-ordeno-fijo');
    if (bloqueOrdeno) bloqueOrdeno.style.display = 'block';

    init();
        };
  }

const btnIrAltaAnimalDesdeOrdeño = document.getElementById('btn-ir-alta-animal');

if (btnIrAltaAnimalDesdeOrdeño) {
  btnIrAltaAnimalDesdeOrdeño.onclick = () => {
    volverAltaAnimalARegistro = true;

    const pantallaAlta = document.getElementById('pantalla-alta-animal');

    // Ocultar entorno ordeño
    const header = document.getElementById('header-ordeno');
    const nav = document.getElementById('navegacion-turnos');
    const grid = document.getElementById('grid');
    const resumen = document.getElementById('comparador-resumen');
    const panelTurno = document.getElementById('panel-turno-fijo');

    if (header) header.style.display = 'none';
    if (nav) nav.style.display = 'none';
    if (grid) grid.style.display = 'none';
    if (resumen) resumen.style.display = 'none';
    if (panelTurno) panelTurno.style.display = 'none';

    const bloqueOrdeno = document.getElementById('bloque-ordeno-fijo');
    if (bloqueOrdeno) bloqueOrdeno.style.display = 'none';

    // Mostrar pantalla de animales
    if (pantallaAlta) pantallaAlta.style.display = 'block';
    mostrarModoAnimal('alta');
  };
}

const btnAltaAnimal = document.getElementById('btn-alta-animal');
if (btnAltaAnimal) {
  btnAltaAnimal.onclick = () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaAlta = document.getElementById('pantalla-alta-animal');

    if (pantallaInicio) pantallaInicio.style.display = 'none';
    if (pantallaAlta) pantallaAlta.style.display = 'block';

    mostrarModoAnimal('alta');
  };
}

  const btnVolverAlta = document.getElementById('btn-volver-alta');
if (btnVolverAlta) {
  btnVolverAlta.onclick = async () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaAlta = document.getElementById('pantalla-alta-animal');

    if (pantallaAlta) pantallaAlta.style.display = 'none';

    if (volverAltaAnimalARegistro) {
      const header = document.getElementById('header-ordeno');
      const nav = document.getElementById('navegacion-turnos');
      const grid = document.getElementById('grid');
      const resumen = document.getElementById('comparador-resumen');
      const panelTurno = document.getElementById('panel-turno-fijo');

      if (header) header.style.display = 'flex';
      if (nav) nav.style.display = 'flex';
      if (grid) grid.style.display = 'flex';
      if (resumen) resumen.style.display = 'flex';
      if (panelTurno) panelTurno.style.display = 'block';

      if (panelTurno) panelTurno.style.display = 'block';

      const bloqueOrdeno = document.getElementById('bloque-ordeno-fijo');
      if (bloqueOrdeno) bloqueOrdeno.style.display = 'block';

      volverAltaAnimalARegistro = false;
      await init();
      return;
    }

    if (pantallaInicio) pantallaInicio.style.display = 'block';
  };
}

    const btnModoAltaAnimal = document.getElementById('btn-modo-alta-animal');
    if (btnModoAltaAnimal) {
      btnModoAltaAnimal.onclick = () => {
        mostrarModoAnimal('alta');
      };
    }

    const btnModoModificarAnimal = document.getElementById('btn-modo-modificar-animal');
    if (btnModoModificarAnimal) {
      btnModoModificarAnimal.onclick = () => {
        mostrarModoAnimal('modificar');
      };
    }

const inputPosicionesTurno = document.getElementById('input-posiciones-turno');
if (inputPosicionesTurno) {
  inputPosicionesTurno.oninput = () => {
    generarGridTurnoEdicion();
  };
}
  
const btnCrearTurnos = document.getElementById('btn-crear-turnos');
if (btnCrearTurnos) {
  btnCrearTurnos.onclick = async () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaTurnos = document.getElementById('pantalla-crear-turnos');
    const pantallaActualizar = document.getElementById('pantalla-actualizar-turnos');

    if (pantallaInicio) pantallaInicio.style.display = 'none';
    if (pantallaActualizar) pantallaActualizar.style.display = 'none';
    if (pantallaTurnos) pantallaTurnos.style.display = 'block';

    await cargarCrotalesDisponibles();
    console.log('Crotales cargados en datalist');
    await cargarInfoTurnosCreados();

    generarGridTurnoEdicion();
  };
}

const btnIrActualizarTurnos = document.getElementById('btn-ir-actualizar-turnos');

if (btnIrActualizarTurnos) {
  btnIrActualizarTurnos.onclick = async () => {
    const pantallaCrearTurnos = document.getElementById('pantalla-crear-turnos');
    const pantallaActualizar = document.getElementById('pantalla-actualizar-turnos');

    if (pantallaCrearTurnos) pantallaCrearTurnos.style.display = 'none';
    if (pantallaActualizar) pantallaActualizar.style.display = 'block';

    await cargarCrotalesDisponibles();
    await cargarTurnosParaActualizar();
    activarSeguimientoCambiosTurno();
  };
}

const btnModoModificarTurnos = document.getElementById('btn-modo-modificar-turnos');
if (btnModoModificarTurnos) {
  btnModoModificarTurnos.onclick = async () => {
    const pantallaCrearTurnos = document.getElementById('pantalla-crear-turnos');
    const pantallaActualizar = document.getElementById('pantalla-actualizar-turnos');

    if (pantallaCrearTurnos) pantallaCrearTurnos.style.display = 'none';
    if (pantallaActualizar) pantallaActualizar.style.display = 'block';

    await cargarCrotalesDisponibles();
    await cargarTurnosParaActualizar();
    activarSeguimientoCambiosTurno();
  };
}

const btnModoCrearTurnosDesdeModificar = document.getElementById('btn-modo-crear-turnos-desde-modificar');
if (btnModoCrearTurnosDesdeModificar) {
  btnModoCrearTurnosDesdeModificar.onclick = async () => {
    if (hayCambiosTurno) {
      const continuar = confirm('Hay cambios sin guardar. ¿Quieres salir sin guardar?');
      if (!continuar) {
        return;
      }
    }

    const pantallaCrearTurnos = document.getElementById('pantalla-crear-turnos');
    const pantallaActualizar = document.getElementById('pantalla-actualizar-turnos');

    if (pantallaActualizar) pantallaActualizar.style.display = 'none';
    if (pantallaCrearTurnos) pantallaCrearTurnos.style.display = 'block';

    hayCambiosTurno = false;

    await cargarCrotalesDisponibles();
    await cargarInfoTurnosCreados();
  };
}

  const btnVolverTurnos = document.getElementById('btn-volver-turnos');
  if (btnVolverTurnos) {
    btnVolverTurnos.onclick = () => {
      const pantallaInicio = document.getElementById('pantalla-inicio');
      const pantallaTurnos = document.getElementById('pantalla-crear-turnos');

      if (pantallaTurnos) pantallaTurnos.style.display = 'none';
      if (pantallaInicio) pantallaInicio.style.display = 'block';
    };
  }

const btnActualizarTurnos = document.getElementById('btn-actualizar-turnos');
if (btnActualizarTurnos) {
  btnActualizarTurnos.onclick = async () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaActualizar = document.getElementById('pantalla-actualizar-turnos');

    if (pantallaInicio) pantallaInicio.style.display = 'none';
    if (pantallaActualizar) pantallaActualizar.style.display = 'block';

    await cargarCrotalesDisponibles();
    await cargarTurnosParaActualizar();
    activarSeguimientoCambiosTurno();
  };
}

const selectTurnoEditar = document.getElementById('select-turno-editar');
if (selectTurnoEditar) {
  selectTurnoEditar.onchange = async () => {
    const nuevoTurno = parseInt(selectTurnoEditar.value, 10);

    if (!nuevoTurno) return;

    if (turnoEditandoActual !== null && hayCambiosTurno) {
      const continuar = confirm('Hay cambios sin guardar. ¿Quieres salir sin guardar?');
      if (!continuar) {
        selectTurnoEditar.value = String(turnoEditandoActual);
        return;
      }
    }

    await cargarTurnoEnEdicion(nuevoTurno);
    turnoEditandoActual = nuevoTurno;
    hayCambiosTurno = false;
  };
}

const btnGuardarCambiosTurno = document.getElementById('btn-guardar-cambios-turno');
if (btnGuardarCambiosTurno) {
  btnGuardarCambiosTurno.onclick = async () => {
    await guardarCambiosTurno();
  };
}

const btnEliminarTurno = document.getElementById('btn-eliminar-turno');
if (btnEliminarTurno) {
  btnEliminarTurno.onclick = async () => {
    await eliminarTurno();
  };
}

const btnVolverActualizarTurnos = document.getElementById('btn-volver-actualizar-turnos');
if (btnVolverActualizarTurnos) {
  btnVolverActualizarTurnos.onclick = () => {
    if (hayCambiosTurno) {
      const continuar = confirm('Hay cambios sin guardar. ¿Quieres salir sin guardar?');
      if (!continuar) {
        return;
      }
    }

    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaActualizar = document.getElementById('pantalla-actualizar-turnos');

    if (pantallaActualizar) pantallaActualizar.style.display = 'none';
    if (pantallaInicio) pantallaInicio.style.display = 'block';

    hayCambiosTurno = false;
  };
}

const btnIngresoEconomico = document.getElementById('btn-ingreso-economico');
if (btnIngresoEconomico) {
  btnIngresoEconomico.onclick = () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaIngreso = document.getElementById('pantalla-ingreso-economico');

    if (pantallaInicio) pantallaInicio.style.display = 'none';
    if (pantallaIngreso) pantallaIngreso.style.display = 'block';

    inicializarFechasIngresoEconomico();
    activarFormatoCamposIngreso();
    mostrarModoIngreso('nuevo');
  };
}

const btnModoIngresoNuevo = document.getElementById('btn-modo-ingreso-nuevo');
if (btnModoIngresoNuevo) {
  btnModoIngresoNuevo.onclick = () => {
    mostrarModoIngreso('nuevo');
  };
}

const btnModoIngresoConsulta = document.getElementById('btn-modo-ingreso-consulta');
if (btnModoIngresoConsulta) {
  btnModoIngresoConsulta.onclick = () => {
    mostrarModoIngreso('consulta');
  };
}

const inputAnioConsulta = document.getElementById('ingreso-anio-consulta');
if (inputAnioConsulta) {
  inputAnioConsulta.onchange = async () => {
    await cargarIngresosAnuales();
  };

  inputAnioConsulta.oninput = async () => {
    if (String(inputAnioConsulta.value).length === 4) {
      await cargarIngresosAnuales();
    }
  };
}

const btnVolverIngreso = document.getElementById('btn-volver-ingreso');
if (btnVolverIngreso) {
  btnVolverIngreso.onclick = () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaIngreso = document.getElementById('pantalla-ingreso-economico');

    if (pantallaIngreso) pantallaIngreso.style.display = 'none';
    if (pantallaInicio) pantallaInicio.style.display = 'block';
  };
}

const btnGuardarIngreso = document.getElementById('btn-guardar-ingreso');
if (btnGuardarIngreso) {
  btnGuardarIngreso.onclick = async () => {
    await guardarIngresoEconomico();
  };
}

const btnInformes = document.getElementById('btn-informes');
if (btnInformes) {
  btnInformes.onclick = () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaInformes = document.getElementById('pantalla-informes');

    if (pantallaInicio) pantallaInicio.style.display = 'none';
    if (pantallaInformes) pantallaInformes.style.display = 'block';
  };
}

const btnVolverInformes = document.getElementById('btn-volver-informes');
if (btnVolverInformes) {
  btnVolverInformes.onclick = () => {
    const pantallaInicio = document.getElementById('pantalla-inicio');
    const pantallaInformes = document.getElementById('pantalla-informes');

    if (pantallaInformes) pantallaInformes.style.display = 'none';
    if (pantallaInicio) pantallaInicio.style.display = 'block';
  };
}

const btnInformeProduccion = document.getElementById('btn-informe-produccion');
if (btnInformeProduccion) {
  btnInformeProduccion.onclick = () => {
    const pantallaInformes = document.getElementById('pantalla-informes');
    const pantallaProduccion = document.getElementById('pantalla-informe-produccion');

    if (pantallaInformes) pantallaInformes.style.display = 'none';
    if (pantallaProduccion) pantallaProduccion.style.display = 'block';
  };
}

const btnProduccionFecha = document.getElementById('btn-produccion-fecha');
if (btnProduccionFecha) {
  btnProduccionFecha.onclick = () => {
    const pantallaProduccion = document.getElementById('pantalla-informe-produccion');
    const pantallaFecha = document.getElementById('pantalla-produccion-fecha');

    if (pantallaProduccion) pantallaProduccion.style.display = 'none';
    if (pantallaFecha) pantallaFecha.style.display = 'block';

    inicializarFechasPorDefecto();
    inicializarMesesGraficoProduccion();
  };
}

const btnBuscarProduccionFecha = document.getElementById('btn-buscar-produccion-fecha');
if (btnBuscarProduccionFecha) {
  btnBuscarProduccionFecha.onclick = async () => {
    await buscarProduccionPorFecha();
  };
}

const btnVolverProduccionFecha = document.getElementById('btn-volver-produccion-fecha');
if (btnVolverProduccionFecha) {
  btnVolverProduccionFecha.onclick = () => {
    const pantallaProduccion = document.getElementById('pantalla-informe-produccion');
    const pantallaFecha = document.getElementById('pantalla-produccion-fecha');

    if (pantallaFecha) pantallaFecha.style.display = 'none';
    if (pantallaProduccion) pantallaProduccion.style.display = 'block';
  };
}

const btnExportarExcelFecha = document.getElementById('btn-exportar-excel-fecha');
if (btnExportarExcelFecha) {
  btnExportarExcelFecha.onclick = () => {
    exportarProduccionFechaCSV();
  };
}

const btnExportarPdfFecha = document.getElementById('btn-exportar-pdf-fecha');
if (btnExportarPdfFecha) {
  btnExportarPdfFecha.onclick = () => {
    exportarResultadoPDF('Producción por fecha', 'resultado-produccion-fecha');
  };
}

const btnExportarPdfAnimal = document.getElementById('btn-exportar-pdf-animal');
if (btnExportarPdfAnimal) {
  btnExportarPdfAnimal.onclick = () => {
    exportarResultadoPDF('Producción por animal', 'resultado-produccion-animal');
  };
}

const btnProduccionAnimal = document.getElementById('btn-produccion-animal');

if (btnProduccionAnimal) {
  btnProduccionAnimal.onclick = async () => {
    const pantallaInformes = document.getElementById('pantalla-informes');
    const pantallaProduccionAnimal = document.getElementById('pantalla-produccion-animal');

    if (pantallaInformes) pantallaInformes.style.display = 'none';
    if (pantallaProduccionAnimal) pantallaProduccionAnimal.style.display = 'block';

    // 👇 INICIALIZA FECHAS (MES ACTUAL)
    inicializarFechasAnimalMesActual();

    // 👇 PINTA GRAFICO AUTOMATICAMENTE
    await pintarGraficoTopAnimales();
  };
}


const btnExportarExcelAnimal = document.getElementById('btn-exportar-excel-animal');
if (btnExportarExcelAnimal) {
  btnExportarExcelAnimal.onclick = () => {
    exportarProduccionAnimalCSV();
  };
}

const btnExportarExcelAnimales = document.getElementById('btn-exportar-excel-animales');
if (btnExportarExcelAnimales) {
  btnExportarExcelAnimales.onclick = () => {
    exportarAnimalesCSV();
  };
}

const btnExportarPdfAnimales = document.getElementById('btn-exportar-pdf-animales');
if (btnExportarPdfAnimales) {
  btnExportarPdfAnimales.onclick = () => {
    exportarResultadoPDF('Informe de animales', 'resultado-informe-animales');
  };
}

const btnVolverProduccionAnimal = document.getElementById('btn-volver-produccion-animal');
if (btnVolverProduccionAnimal) {
  btnVolverProduccionAnimal.onclick = () => {
    const pantallaProduccion = document.getElementById('pantalla-informe-produccion');
    const pantallaAnimal = document.getElementById('pantalla-produccion-animal');

    if (pantallaAnimal) pantallaAnimal.style.display = 'none';
    if (pantallaProduccion) pantallaProduccion.style.display = 'block';
  };
}

const btnBuscarProduccionAnimal = document.getElementById('btn-buscar-produccion-animal');
if (btnBuscarProduccionAnimal) {
  btnBuscarProduccionAnimal.onclick = async () => { await pintarGraficoTopAnimales();
    await buscarProduccionPorAnimal();
  };
}

const btnVolverProduccion = document.getElementById('btn-volver-produccion');
if (btnVolverProduccion) {
  btnVolverProduccion.onclick = () => {
    const pantallaInformes = document.getElementById('pantalla-informes');
    const pantallaProduccion = document.getElementById('pantalla-informe-produccion');

    if (pantallaProduccion) pantallaProduccion.style.display = 'none';
    if (pantallaInformes) pantallaInformes.style.display = 'block';
  };
}

const btnGraficoFecha = document.getElementById('btn-actualizar-grafico-fecha');
if (btnGraficoFecha) {
  btnGraficoFecha.onclick = async () => {
    await pintarGraficoProduccionFecha();
  };
}

const btnInformeAnimales = document.getElementById('btn-informe-animales');
if (btnInformeAnimales) {
  btnInformeAnimales.onclick = () => {
    const pantallaInformes = document.getElementById('pantalla-informes');
    const pantallaAnimales = document.getElementById('pantalla-informe-animales');

    if (pantallaInformes) pantallaInformes.style.display = 'none';
    if (pantallaAnimales) pantallaAnimales.style.display = 'block';

    cargarResumenEstadosAnimales();
  };
}

const btnVolverInformeAnimales = document.getElementById('btn-volver-informe-animales');
if (btnVolverInformeAnimales) {
  btnVolverInformeAnimales.onclick = () => {
    const pantallaInformes = document.getElementById('pantalla-informes');
    const pantallaAnimales = document.getElementById('pantalla-informe-animales');

    if (pantallaAnimales) pantallaAnimales.style.display = 'none';
    if (pantallaInformes) pantallaInformes.style.display = 'block';
  };
}

  const btnGuardarTurno = document.getElementById('btn-guardar-turno');
console.log('btnGuardarTurno encontrado:', btnGuardarTurno);

if (btnGuardarTurno) {
  btnGuardarTurno.onclick = async () => {
    console.log('Click en Guardar turno');
    await guardarTurnoBase();
  };
}

 
    const btnBuscarInformeAnimales = document.getElementById('btn-buscar-informe-animales');
    if (btnBuscarInformeAnimales) {
      btnBuscarInformeAnimales.onclick = async () => {
        await buscarInformeAnimales();
      };
    }

    const btnVolver = document.getElementById('btn-volver');
    if (btnVolver) {
      btnVolver.onclick = () => {
        const pantallaInicio = document.getElementById('pantalla-inicio');
        if (pantallaInicio) pantallaInicio.style.display = 'block';

        const header = document.getElementById('header-ordeno');
        const nav = document.getElementById('navegacion-turnos');
        const grid = document.getElementById('grid');
        const resumen = document.getElementById('comparador-resumen');

        if (header) header.style.display = 'none';
        if (nav) nav.style.display = 'none';
        if (grid) grid.style.display = 'none';
        if (resumen) resumen.style.display = 'none';

        const panelTurno = document.getElementById('panel-turno-fijo');
        if (panelTurno) panelTurno.style.display = 'none';
        
        const bloqueOrdeno = document.getElementById('bloque-ordeno-fijo');
        if (bloqueOrdeno) bloqueOrdeno.style.display = 'none';
      };
    }

  const btnGuardarAnimal = document.getElementById('btn-guardar-animal');
  if (btnGuardarAnimal) {
    btnGuardarAnimal.onclick = async () => {
      await guardarAnimal();
    };
  }

  const btnActualizarEstado = document.getElementById('btn-actualizar-estado');
  if (btnActualizarEstado) {
    btnActualizarEstado.onclick = async () => {
      await actualizarEstadoAnimal();
    };
  }
}
async function guardarAnimal() {
  const inputCrotal = document.getElementById('input-crotal');
  const inputEstado = document.getElementById('input-estado');

  const crotal = inputCrotal?.value.trim();
  const estado = inputEstado?.value;

  if (!crotal) {
    alert('Introduce un crotal');
    return;
  }

  const { error } = await supabase
    .from('animales')
    .insert({
      crotal,
      estado
    });

  if (error) {
    console.error('Error guardando animal:', error);
    alert('No se pudo guardar el animal');
    return;
  }

  alert('Animal guardado correctamente');

  if (inputCrotal) inputCrotal.value = '';
  if (inputEstado) inputEstado.value = 'PRODUCTIVO';
}
async function actualizarEstadoAnimal() {
  const inputCrotalEstado = document.getElementById('input-crotal-estado');
  const inputEstadoNuevo = document.getElementById('input-estado-nuevo');

  const crotal = inputCrotalEstado?.value.trim();
  const estado = inputEstadoNuevo?.value;

  if (!crotal) {
    alert('Introduce un crotal existente');
    return;
  }

    const { data, error } = await supabase
    .from('animales')
    .update({ estado })
    .eq('crotal', crotal)
    .select();

  if (error) {
    console.error('Error actualizando estado:', error);
    alert('No se pudo actualizar el estado');
    return;
  }

  if (!data || data.length === 0) {
    alert('El crotal no existe. Debes dar de alta el animal primero.');
    return;
  }

  alert('Estado actualizado correctamente');

  if (inputCrotalEstado) inputCrotalEstado.value = '';
  if (inputEstadoNuevo) inputEstadoNuevo.value = 'PRODUCTIVO';
}

async function cargarResumenEstadosAnimales() {
  const contenedor = document.getElementById('resumen-estados-animales');

  const { data, error } = await supabase
    .from('animales')
    .select('estado');

  if (error) {
    console.error('Error cargando estados:', error);
    return;
  }

  const resumen = {};

  (data || []).forEach(a => {
    const estado = a.estado || 'SIN_ESTADO';

    if (!resumen[estado]) {
      resumen[estado] = 0;
    }

    resumen[estado]++;
  });

  contenedor.innerHTML = '';

  Object.entries(resumen).forEach(([estado, cantidad]) => {
    const div = document.createElement('div');
    div.style.padding = '8px';
    div.style.background = '#fff';
    div.style.border = '1px solid #ddd';
    div.style.borderRadius = '6px';

    div.textContent = `${estado} → ${cantidad}`;

    contenedor.appendChild(div);
  });
}

async function buscarInformeAnimales() {
  const filtroCrotal = document.getElementById('filtro-animales-crotal')?.value.trim() || '';
  const filtroEstado = document.getElementById('filtro-animales-estado')?.value || '';
  const contenedor = document.getElementById('resultado-informe-animales');

  let query = supabase
    .from('animales')
    .select('crotal, estado')
    .order('crotal', { ascending: true });

  if (filtroCrotal) {
    query = query.ilike('crotal', `%${filtroCrotal}%`);
  }

  if (filtroEstado) {
    query = query.eq('estado', filtroEstado);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error cargando informe de animales:', error);
    alert('Error cargando animales');
    return;
  }

  contenedor.innerHTML = '';

  if (!data || data.length === 0) {
    contenedor.textContent = 'Sin resultados';
    return;
  }

  data.forEach(animal => {
    const div = document.createElement('div');
    div.style.padding = '10px';
    div.style.background = '#fff';
    div.style.border = '1px solid #ddd';
    div.style.borderRadius = '8px';
    div.style.marginBottom = '8px';

    div.textContent = `${animal.crotal} → ${animal.estado}`;

    contenedor.appendChild(div);
  });
}

function exportarProduccionFechaCSV() {
  const resultado = document.getElementById('resultado-produccion-fecha');

  if (!resultado || !resultado.children.length) {
    alert('No hay datos para exportar');
    return;
  }

  const filas = [['Fecha', 'Litros']];

  Array.from(resultado.children).forEach(div => {
    const texto = div.textContent || '';
    const partes = texto.split('→');

    if (partes.length === 2) {
      const fecha = partes[0].trim();
      const litros = partes[1].replace('L', '').trim();
      filas.push([fecha, litros]);
    }
  });

  const csv = filas.map(fila => fila.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = 'produccion_por_fecha.csv';
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  URL.revokeObjectURL(url);
}

arrancarApp();
window.addEventListener('online', comprobarConexion);
window.addEventListener('offline', comprobarConexion);

async function registrarDesdeCelda(pos) {
  let crotal = pos?.crotal;

  if (!crotal) {
    crotal = prompt('Introduce crotal');
    if (!crotal) return;
  }

  const litrosInput = prompt(`Litros para ${crotal}`);
  if (!litrosInput) return;

  const litros = parseFloat(litrosInput);

  if (isNaN(litros)) {
    alert('Valor inválido');
    return;
  }

  const hora = new Date().getHours();
  const ordeno = hora < 12 ? 'MANANA' : 'TARDE';

  const { error } = await supabase.from('produccion').upsert({
    crotal,
    fecha: new Date().toISOString().split('T')[0],
    hora: new Date().toTimeString().split(' ')[0],
    ordeno,
    litros
  }, {
    onConflict: 'crotal,fecha,ordeno'
  });

    if (error) {
    console.error('Error guardando producción:', error);
    alert('Error al guardar la producción');
    return;
  }

  cerrarModal();
  await init();
}
