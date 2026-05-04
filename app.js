// ===== CONFIG SUPABASE – mesmo projeto dos formulários dos PECs
const SUPABASE_URL = 'https://xdaanjevbvgqwasjqcew.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhkYWFuamV2YnZncXdhc2pxY2V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMDY4NDEsImV4cCI6MjA3NzU4Mjg0MX0.Pf-o3Wa9dLswwd4O8QFcH2v6oXHbvsSXrjIKJMUOz7E';

let allData = [];
let chartEscolas = null;

function parseTipo(activityType) {
    if (!activityType) return null;
    const [prefix] = activityType.split(':');
    return prefix ? prefix.trim() : null;
}

function parseTema(activityType) {
    if (!activityType) return '';
    const parts = activityType.split(':');
    if (parts.length < 2) return '';
    return parts.slice(1).join(':').trim();
}

function formatDate(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-');
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
}

// ─── FETCH COM PAGINAÇÃO COMPLETA ────────────────────────────────────────────
// O Supabase limita 1000 linhas por request. Esta função busca todas as páginas.
async function fetchData() {
    const PAGE_SIZE = 1000;
    let allRows = [];
    let offset = 0;

    while (true) {
        const url = `${SUPABASE_URL}/rest/v1/pec_submissions?select=*`
            + `&order=visit_date.desc`
            + `&limit=${PAGE_SIZE}&offset=${offset}`;

        const res = await fetch(url, {
            headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
            },
        });

        if (!res.ok) {
            console.error('Erro ao carregar dados:', res.status, await res.text());
            break;
        }

        const page = await res.json();
        allRows = allRows.concat(page);

        // Se veio menos que PAGE_SIZE, chegamos ao fim
        if (page.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
    }

    return allRows;
}

function initFilters(data) {
    const escolaSelect = document.getElementById('filter-escola');
    const temaSelect = document.getElementById('filter-tema');
    const pecSelect = document.getElementById('filter-pec');

    const escolasSet = new Set();
    const temasSet = new Set();
    const pecsSet = new Set();

    data.forEach((row) => {
        if (row.school_name) escolasSet.add(row.school_name.trim());

        const tema = parseTema(row.activity_type);
        if (tema) temasSet.add(tema);

        if (row.pec_name) {
            const nomes = row.pec_name.split(';').map((n) => n.trim()).filter(Boolean);
            nomes.forEach((n) => pecsSet.add(n));
        }
    });

    [...escolasSet].sort().forEach((escola) => {
        const opt = document.createElement('option');
        opt.value = escola;
        opt.textContent = escola;
        escolaSelect.appendChild(opt);
    });

    [...temasSet].sort().forEach((tema) => {
        const opt = document.createElement('option');
        opt.value = tema;
        opt.textContent = tema;
        temaSelect.appendChild(opt);
    });

    [...pecsSet].sort().forEach((pec) => {
        const opt = document.createElement('option');
        opt.value = pec;
        opt.textContent = pec;
        pecSelect.appendChild(opt);
    });

    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    const filterTipo = document.getElementById('filter-tipo');
    if (tab === 'visitas') {
        filterTipo.value = 'Visita';
    } else if (tab === 'apoio') {
        filterTipo.value = 'Apoio presencial';
    }

    [
        'filter-escola',
        'filter-pec',
        'filter-tipo',
        'filter-tema',
        'filter-data-inicio',
        'filter-data-fim',
    ].forEach((id) => {
        document.getElementById(id).addEventListener('change', applyFiltersAndRender);
    });
}

function getFilteredData() {
    const escola = document.getElementById('filter-escola').value;
    const pec = document.getElementById('filter-pec').value;
    const tipo = document.getElementById('filter-tipo').value;
    const tema = document.getElementById('filter-tema').value;
    const dataInicio = document.getElementById('filter-data-inicio').value;
    const dataFim = document.getElementById('filter-data-fim').value;

    return allData.filter((row) => {
        const rowEscola = (row.school_name || '').trim();
        const rowTipo = parseTipo(row.activity_type);
        const rowTema = parseTema(row.activity_type);
        const rowData = row.visit_date || '';
        const rowPecRaw = (row.pec_name || '').trim();

        const rowPecList = rowPecRaw
            ? rowPecRaw.split(';').map((n) => n.trim()).filter(Boolean)
            : [];

        if (escola !== '__all__' && rowEscola !== escola) return false;
        if (tipo !== '__all__' && rowTipo !== tipo) return false;
        if (tema !== '__all__' && rowTema !== tema) return false;

        if (pec !== '__all__') {
            if (!rowPecList.includes(pec)) return false;
        }

        if (dataInicio && rowData < dataInicio) return false;
        if (dataFim && rowData > dataFim) return false;

        return true;
    });
}

function updateMetrics(filtered) {
    const total = filtered.length;
    const escolas = new Set(filtered.map((r) => (r.school_name || '').trim()).filter(Boolean)).size;
    const visitas = filtered.filter((r) => parseTipo(r.activity_type) === 'Visita').length;
    const apoios = filtered.filter((r) => parseTipo(r.activity_type) === 'Apoio presencial').length;

    document.getElementById('metric-total').textContent = total;
    document.getElementById('metric-escolas').textContent = escolas;
    document.getElementById('metric-visitas').textContent = visitas;
    document.getElementById('metric-apoios').textContent = apoios;

    const metricTotalFoot = document.getElementById('metric-total-footnote');
    const vFoot = document.getElementById('metric-visitas-footnote');
    const aFoot = document.getElementById('metric-apoios-footnote');

    if (total === 0) {
        metricTotalFoot.textContent = 'Nenhum registro encontrado com o filtro atual.';
    } else {
        metricTotalFoot.textContent = `De ${allData.length} registros no total.`;
    }

    vFoot.textContent = total ? `${((visitas / total) * 100).toFixed(1)}% do total` : '';
    aFoot.textContent = total ? `${((apoios / total) * 100).toFixed(1)}% do total` : '';

    document.getElementById('table-badge').textContent = `${total} registro(s)`;
}

function updateChartEscolas(filtered) {
    const badge = document.getElementById('chart-badge');

    if (!filtered.length) {
        if (chartEscolas) {
            chartEscolas.destroy();
            chartEscolas = null;
        }
        badge.textContent = 'Sem dados no filtro atual';
        return;
    }

    badge.textContent = `${filtered.length} registro(s)`;

    const agrupado = {};

    filtered.forEach((row) => {
        const esc = (row.school_name || 'Sem escola').trim();
        const tipo = parseTipo(row.activity_type);

        if (!agrupado[esc]) {
            agrupado[esc] = { visitas: 0, apoios: 0 };
        }
        if (tipo === 'Visita') agrupado[esc].visitas++;
        if (tipo === 'Apoio presencial') agrupado[esc].apoios++;
    });

    const labels = Object.keys(agrupado).sort();
    const dataVisitas = labels.map((e) => agrupado[e].visitas);
    const dataApoios = labels.map((e) => agrupado[e].apoios);

    const ctx = document.getElementById('chart-escolas').getContext('2d');
    if (chartEscolas) {
        chartEscolas.destroy();
    }

    chartEscolas = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Visitas',
                    data: dataVisitas,
                    backgroundColor: 'rgba(34, 211, 238, 0.6)',
                },
                {
                    label: 'Apoios presenciais',
                    data: dataApoios,
                    backgroundColor: 'rgba(16, 185, 129, 0.6)',
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    ticks: {
                        font: { size: 10 },
                    },
                },
                y: {
                    beginAtZero: true,
                    precision: 0,
                },
            },
            plugins: {
                legend: {
                    labels: {
                        font: { size: 10 },
                    },
                },
            },
        },
    });
}

function updateTemasRanking(filtered) {
    const container = document.getElementById('temas-ranking');

    if (!filtered.length) {
        container.className = 'empty-state';
        container.textContent = 'Nenhum registro no filtro atual.';
        return;
    }

    const contagem = {};
    filtered.forEach((row) => {
        const tema = parseTema(row.activity_type) || 'Sem tema';
        contagem[tema] = (contagem[tema] || 0) + 1;
    });

    const itens = Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

    container.className = '';
    container.innerHTML = '';

    itens.forEach(([tema, qtd]) => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.justifyContent = 'space-between';
        div.style.alignItems = 'center';
        div.style.marginBottom = '4px';

        const spanTema = document.createElement('span');
        spanTema.textContent = tema;
        spanTema.style.fontSize = '0.8rem';

        const spanQtd = document.createElement('span');
        spanQtd.textContent = qtd;
        spanQtd.style.fontSize = '0.8rem';
        spanQtd.style.color = '#a5f3fc';

        div.appendChild(spanTema);
        div.appendChild(spanQtd);
        container.appendChild(div);
    });
}

function updateTable(filtered) {
    const tbody = document.getElementById('tbody-registros');
    tbody.innerHTML = '';

    if (!filtered.length) {
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = 6;
        td.className = 'empty-state';
        td.textContent = 'Nenhum registro encontrado com o filtro atual.';
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    filtered.forEach((row) => {
        const tr = document.createElement('tr');

        const tdData = document.createElement('td');
        tdData.textContent = formatDate(row.visit_date);
        tr.appendChild(tdData);

        const tipo = parseTipo(row.activity_type);
        const tema = parseTema(row.activity_type);

        const tdTipo = document.createElement('td');
        const pill = document.createElement('span');
        pill.className = 'pill ' + (tipo === 'Visita' ? 'pill-visita' : 'pill-apoio');
        pill.textContent = tipo || '-';
        tdTipo.appendChild(pill);
        tr.appendChild(tdTipo);

        const tdTema = document.createElement('td');
        tdTema.textContent = tema || '-';
        tdTema.className = 'truncate';
        tr.appendChild(tdTema);

        const tdEscola = document.createElement('td');
        tdEscola.textContent = (row.school_name || '-').trim();
        tdEscola.className = 'truncate';
        tr.appendChild(tdEscola);

        const tdPec = document.createElement('td');
        tdPec.textContent = (row.pec_name || '-').trim();
        tdPec.className = 'truncate';
        tr.appendChild(tdPec);

        const tdObs = document.createElement('td');
        tdObs.textContent = (row.notes || '').trim() || '-';
        tdObs.className = 'truncate';
        tr.appendChild(tdObs);

        tbody.appendChild(tr);
    });
}

function applyFiltersAndRender() {
    const filtered = getFilteredData();
    updateMetrics(filtered);
    updateChartEscolas(filtered);
    updateTemasRanking(filtered);
    updateTable(filtered);
}

async function init() {
    allData = await fetchData();
    initFilters(allData);
    applyFiltersAndRender();
}

document.addEventListener('DOMContentLoaded', init);
