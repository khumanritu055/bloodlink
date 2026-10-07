const GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const $ = (id) => document.getElementById(id);
const toast = new bootstrap.Toast($('appToast'), { delay: 2500 });
const donorModal = new bootstrap.Modal($('donorModal'));
const requestModal = new bootstrap.Modal($('requestModal'));
const matchModal = new bootstrap.Modal($('matchModal'));
const deleteModal = new bootstrap.Modal($('deleteModal'));

let chart = null;
let pendingDelete = null; // { type: 'donors' | 'requests', id }

// ---------- helpers ----------
function showToast(msg) {
  $('toastMsg').textContent = msg;
  toast.show();
}

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

function fmtDate(d) {
  return d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Kuch galat ho gaya');
  return data;
}

function fillGroupSelect(select, withAll) {
  select.innerHTML = (withAll ? '<option value="">All Groups</option>' : '') +
    GROUPS.map((g) => `<option value="${g}">${g}</option>`).join('');
}

fillGroupSelect($('dGroup'), true);
fillGroupSelect($('rGroup'), true);
fillGroupSelect($('dfGroup'), false);
fillGroupSelect($('rfGroup'), false);

// ---------- tabs ----------
document.querySelectorAll('#tabNav .nav-link').forEach((link) => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    showTab(link.dataset.tab);
  });
});

function showTab(name) {
  ['dashboard', 'donors', 'requests'].forEach((t) => {
    $('tab-' + t).classList.toggle('d-none', t !== name);
  });
  document.querySelectorAll('#tabNav .nav-link').forEach((l) =>
    l.classList.toggle('active', l.dataset.tab === name)
  );
  const nav = document.getElementById('nav');
  if (nav.classList.contains('show')) bootstrap.Collapse.getInstance(nav)?.hide();

  if (name === 'dashboard') loadDashboard();
  if (name === 'donors') loadDonors();
  if (name === 'requests') loadRequests();
}

// ---------- DASHBOARD ----------
async function loadDashboard() {
  try {
    const [d, r, urgent] = await Promise.all([
      api('/api/donors/stats/summary'),
      api('/api/requests/stats/summary'),
      api('/api/requests?status=Open')
    ]);
    $('sTotal').textContent = d.total;
    $('sAvail').textContent = d.available;
    $('sOpen').textContent = r.open;
    $('sDone').textContent = r.fulfilled;

    const counts = GROUPS.map((g) => d.byGroup.find((x) => x._id === g)?.count || 0);
    if (chart) chart.destroy();
    chart = new Chart($('groupChart'), {
      type: 'bar',
      data: {
        labels: GROUPS,
        datasets: [{ label: 'Donors', data: counts, backgroundColor: '#c62828', borderRadius: 6 }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
      }
    });

    const hot = urgent.filter((x) => x.urgency !== 'Normal').slice(0, 5);
    $('urgentList').innerHTML = hot.length
      ? hot.map((x) => `
          <div class="d-flex justify-content-between align-items-center border-bottom py-2">
            <div><strong>${esc(x.bloodGroup)}</strong> &middot; ${esc(x.patientName)}<br>
              <span class="text-muted">${esc(x.hospital)}, ${esc(x.city)}</span></div>
            <span class="badge ${x.urgency === 'Critical' ? 'text-bg-danger' : 'text-bg-warning'}">${x.urgency}</span>
          </div>`).join('')
      : '<p class="text-muted mb-0">Abhi koi urgent request nahi hai.</p>';
  } catch (err) {
    showToast('Server se connect nahi ho paaya');
  }
}

// ---------- DONORS ----------
async function loadDonors() {
  const p = new URLSearchParams();
  if ($('dSearch').value.trim()) p.append('search', $('dSearch').value.trim());
  if ($('dGroup').value) p.append('bloodGroup', $('dGroup').value);
  if ($('dCity').value.trim()) p.append('city', $('dCity').value.trim());
  if ($('dAvail').checked) p.append('available', 'true');

  try {
    const donors = await api('/api/donors?' + p);
    $('donorEmpty').classList.toggle('d-none', donors.length > 0);
    $('donorTable').innerHTML = donors.map((d) => `
      <tr>
        <td class="fw-semibold">${esc(d.name)}<div class="small text-muted">${esc(d.gender)}</div></td>
        <td><span class="badge blood-badge">${esc(d.bloodGroup)}</span></td>
        <td>${d.age}</td>
        <td>${esc(d.city)}</td>
        <td><a href="tel:${esc(d.phone)}" class="text-decoration-none">${esc(d.phone)}</a></td>
        <td>${fmtDate(d.lastDonation)}</td>
        <td>
          <button class="btn btn-sm ${d.available ? 'btn-success' : 'btn-outline-secondary'}" data-act="toggle" data-id="${d._id}">
            ${d.available ? 'Available' : 'Unavailable'}
          </button>
        </td>
        <td class="text-end">
          <button class="btn btn-outline-primary btn-sm btn-icon me-1" data-act="edit" data-id="${d._id}"><i class="bi bi-pencil"></i></button>
          <button class="btn btn-outline-danger btn-sm btn-icon" data-act="delete" data-id="${d._id}" data-name="${esc(d.name)}"><i class="bi bi-trash"></i></button>
        </td>
      </tr>`).join('');
  } catch (err) {
    showToast('Server se connect nahi ho paaya');
  }
}

let t;
['dSearch', 'dCity'].forEach((id) =>
  $(id).addEventListener('input', () => { clearTimeout(t); t = setTimeout(loadDonors, 300); })
);
$('dGroup').addEventListener('change', loadDonors);
$('dAvail').addEventListener('change', loadDonors);

$('addDonorBtn').addEventListener('click', () => {
  $('donorForm').reset();
  $('donorId').value = '';
  $('donorModalTitle').textContent = 'Register Donor';
  $('donorError').classList.add('d-none');
  donorModal.show();
});

$('donorTable').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;

  try {
    if (btn.dataset.act === 'toggle') {
      await api(`/api/donors/${id}/availability`, { method: 'PATCH' });
      loadDonors();
    }
    if (btn.dataset.act === 'edit') {
      const d = await api(`/api/donors/${id}`);
      $('donorId').value = d._id;
      $('dfName').value = d.name;
      $('dfAge').value = d.age;
      $('dfGender').value = d.gender;
      $('dfGroup').value = d.bloodGroup;
      $('dfPhone').value = d.phone;
      $('dfCity').value = d.city;
      $('dfLast').value = d.lastDonation ? d.lastDonation.slice(0, 10) : '';
      $('donorModalTitle').textContent = 'Edit Donor';
      $('donorError').classList.add('d-none');
      donorModal.show();
    }
    if (btn.dataset.act === 'delete') {
      askDelete('donors', id, `Donor "${btn.dataset.name}" ko delete karein?`);
    }
  } catch (err) {
    showToast(err.message);
  }
});

$('donorForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('donorError');
  err.classList.add('d-none');

  const data = {
    name: $('dfName').value.trim(),
    age: Number($('dfAge').value),
    gender: $('dfGender').value,
    bloodGroup: $('dfGroup').value,
    phone: $('dfPhone').value.trim(),
    city: $('dfCity').value.trim(),
    lastDonation: $('dfLast').value || null
  };

  const fail = (m) => { err.textContent = m; err.classList.remove('d-none'); };
  if (!data.name || !data.city) return fail('Name aur City zaroori hain');
  if (!(data.age >= 18 && data.age <= 65)) return fail('Age 18 se 65 ke beech honi chahiye');
  if (!/^\d{10}$/.test(data.phone)) return fail('Phone number 10 digit ka hona chahiye');
  if (data.lastDonation) {
    const days = (Date.now() - new Date(data.lastDonation)) / 86400000;
    if (days < 0) return fail('Last donation date future me nahi ho sakti');
  }

  const id = $('donorId').value;
  try {
    await api(id ? `/api/donors/${id}` : '/api/donors', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(data)
    });
    donorModal.hide();
    showToast(id ? 'Donor update ho gaya' : 'Donor register ho gaya');
    loadDonors();
  } catch (ex) {
    fail(ex.message);
  }
});

// ---------- REQUESTS ----------
async function loadRequests() {
  const p = new URLSearchParams();
  if ($('rStatus').value) p.append('status', $('rStatus').value);
  if ($('rGroup').value) p.append('bloodGroup', $('rGroup').value);

  try {
    const list = await api('/api/requests?' + p);
    $('requestEmpty').classList.toggle('d-none', list.length > 0);
    $('requestCards').innerHTML = list.map((r) => `
      <div class="col-md-6 col-lg-4">
        <div class="card shadow-sm request-card ${r.status === 'Fulfilled' ? 'done' : r.urgency} h-100">
          <div class="card-body">
            <div class="d-flex justify-content-between align-items-start mb-2">
              <div class="request-group">${esc(r.bloodGroup)}</div>
              <div>
                <span class="badge ${r.urgency === 'Critical' ? 'text-bg-danger' : r.urgency === 'Urgent' ? 'text-bg-warning' : 'text-bg-primary'}">${r.urgency}</span>
                <span class="badge ${r.status === 'Open' ? 'text-bg-secondary' : 'text-bg-success'}">${r.status}</span>
              </div>
            </div>
            <h6 class="mb-1">${esc(r.patientName)}</h6>
            <div class="small text-muted mb-2">${r.units} unit(s) &middot; ${esc(r.hospital)}, ${esc(r.city)}</div>
            <div class="small mb-3"><i class="bi bi-telephone me-1"></i><a href="tel:${esc(r.contactPhone)}" class="text-decoration-none">${esc(r.contactPhone)}</a>
              <span class="text-muted ms-2">${fmtDate(r.createdAt)}</span></div>
            <div class="d-flex gap-2">
              ${r.status === 'Open' ? `
                <button class="btn btn-outline-danger btn-sm flex-fill" data-act="match" data-id="${r._id}">Find Donors</button>
                <button class="btn btn-success btn-sm flex-fill" data-act="fulfill" data-id="${r._id}">Mark Fulfilled</button>` : ''}
              <button class="btn btn-outline-secondary btn-sm btn-icon" data-act="delete" data-id="${r._id}" data-name="${esc(r.patientName)}"><i class="bi bi-trash"></i></button>
            </div>
          </div>
        </div>
      </div>`).join('');
  } catch (err) {
    showToast('Server se connect nahi ho paaya');
  }
}

$('rStatus').addEventListener('change', loadRequests);
$('rGroup').addEventListener('change', loadRequests);

$('addRequestBtn').addEventListener('click', () => {
  $('requestForm').reset();
  $('rfUnits').value = 1;
  $('requestError').classList.add('d-none');
  requestModal.show();
});

$('requestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('requestError');
  err.classList.add('d-none');

  const data = {
    patientName: $('rfPatient').value.trim(),
    bloodGroup: $('rfGroup').value,
    units: Number($('rfUnits').value),
    hospital: $('rfHospital').value.trim(),
    city: $('rfCity').value.trim(),
    contactPhone: $('rfPhone').value.trim(),
    urgency: $('rfUrgency').value
  };

  const fail = (m) => { err.textContent = m; err.classList.remove('d-none'); };
  if (!data.patientName || !data.hospital || !data.city) return fail('Saari * fields bharna zaroori hai');
  if (!(data.units >= 1 && data.units <= 10)) return fail('Units 1 se 10 ke beech hone chahiye');
  if (!/^\d{10}$/.test(data.contactPhone)) return fail('Phone number 10 digit ka hona chahiye');

  try {
    await api('/api/requests', { method: 'POST', body: JSON.stringify(data) });
    requestModal.hide();
    showToast('Request post ho gayi');
    loadRequests();
  } catch (ex) {
    fail(ex.message);
  }
});

$('requestCards').addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const id = btn.dataset.id;

  try {
    if (btn.dataset.act === 'fulfill') {
      await api(`/api/requests/${id}/fulfill`, { method: 'PATCH' });
      showToast('Request fulfilled mark ho gayi');
      loadRequests();
    }
    if (btn.dataset.act === 'match') {
      const donors = await api(`/api/requests/${id}/matches`);
      $('matchBody').innerHTML = donors.length
        ? `<div class="table-responsive"><table class="table align-middle mb-0">
            <thead><tr><th>Name</th><th>Group</th><th>City</th><th>Phone</th><th>Last Donation</th></tr></thead>
            <tbody>${donors.map((d) => `
              <tr><td>${esc(d.name)}</td><td><span class="badge blood-badge">${esc(d.bloodGroup)}</span></td>
              <td>${esc(d.city)}</td><td><a href="tel:${esc(d.phone)}">${esc(d.phone)}</a></td><td>${fmtDate(d.lastDonation)}</td></tr>`).join('')}
            </tbody></table></div>`
        : '<p class="text-muted mb-0">Is blood group aur city me abhi koi available donor nahi mila.</p>';
      matchModal.show();
    }
    if (btn.dataset.act === 'delete') {
      askDelete('requests', id, `Request "${btn.dataset.name}" ko delete karein?`);
    }
  } catch (ex) {
    showToast(ex.message);
  }
});

// ---------- delete confirm ----------
function askDelete(type, id, text) {
  pendingDelete = { type, id };
  $('deleteText').textContent = text;
  deleteModal.show();
}

$('confirmDelete').addEventListener('click', async () => {
  if (!pendingDelete) return;
  const { type, id } = pendingDelete;
  pendingDelete = null;
  try {
    await api(`/api/${type}/${id}`, { method: 'DELETE' });
    deleteModal.hide();
    showToast('Delete ho gaya');
    type === 'donors' ? loadDonors() : loadRequests();
  } catch (ex) {
    showToast(ex.message);
  }
});

// start
loadDashboard();
