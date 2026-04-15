const GAS_URL = "https://script.google.com/macros/s/AKfycbyzZtb2MAnuBBZpb4MfiEanC5gOXRmrqIwHrnvLMIbPibCcX_NpIW02sknXQJkVHUnfhw/exec";
let threads = [];

async function loadThreads() {
    try {
        const response = await fetch(GAS_URL);
        threads = await response.json();
        renderList();
    } catch (e) {
        console.error("로드 실패:", e);
    }
}

const form = document.getElementById('add-form');
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const brand = document.getElementById('brand').value;
    const type = document.getElementById('type').value;
    const colorCodeInput = document.getElementById('colorCode').value;

    // 1. 입력값 정제 및 자체 중복 제거
    const rawCodes = colorCodeInput.split(',')
                                   .map(code => code.trim().toUpperCase())
                                   .filter(code => code !== '');
    const uniqueInputCodes = [...new Set(rawCodes)];

    if (uniqueInputCodes.length === 0) return;

    // 버튼 비활성화 (중복 클릭 방지)
    const btn = form.querySelector('button');
    btn.disabled = true;
    btn.textContent = "저장 중...";

    // 2. 서버로 배열 통째로 전송 (Batch 전송)
    try {
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: 'addBatch', 
                brand: brand, 
                type: type, 
                codes: uniqueInputCodes 
            })
        });
        
        document.getElementById('colorCode').value = '';
        await loadThreads();
    } catch (err) {
        alert("저장 실패");
    } finally {
        btn.disabled = false;
        btn.textContent = "+ 추가";
        document.getElementById('colorCode').focus();
    }
});

async function toggleStock(row, currentStatus) {
    await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: 'toggle', row: row, isOutOfStock: !currentStatus })
    });
    await loadThreads();
}

async function deleteThread(row) {
    if (!confirm("정말 삭제할까요?")) return;
    await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: 'delete', row: row })
    });
    await loadThreads();
}

function getBrandClass(brand) {
    if (brand === 'DMC') return 'brand-DMC';
    if (brand === 'Anchor') return 'brand-Anchor';
    return 'brand-Appleton';
}

function renderStats() {
    const statsRow = document.getElementById('stats-row');
    const total = threads.length;
    const brands = [...new Set(threads.map(t => t.brand))];
    statsRow.innerHTML = `<div class="stat-badge">전체 <strong>${total}</strong>개</div>` +
        brands.map(b => `<div class="stat-badge">${b} <strong>${threads.filter(t => t.brand === b).length}</strong></div>`).join('');
}

function renderList() {
    const listContainer = document.getElementById('thread-list');
    const emptyMessage = document.getElementById('empty-message');
    const threadTable = document.getElementById('thread-table');
    const fBrand = document.getElementById('filter-brand').value;
    const fType = document.getElementById('filter-type').value;

    listContainer.innerHTML = '';
    renderStats();

    const filtered = threads.filter(t => {
        return (fBrand === 'All' || t.brand === fBrand) && (fType === 'All' || t.type === fType);
    });

    if (filtered.length === 0) {
        emptyMessage.style.display = 'block';
        threadTable.style.display = 'none';
    } else {
        emptyMessage.style.display = 'none';
        threadTable.style.display = 'table';
        filtered.forEach(t => {
            const tr = document.createElement('tr');
            if (t.isOutOfStock) tr.classList.add('is-empty');
            tr.innerHTML = `
                <td><span class="brand-badge ${getBrandClass(t.brand)}">${t.brand}</span></td>
                <td><span class="type-tag">${t.type}</span></td>
                <td><span class="color-code">${t.colorCode}</span></td>
                <td>
                    <div class="action-group">
                        <button class="${t.isOutOfStock ? 'btn-restock' : 'btn-empty'}" onclick="toggleStock(${t.row}, ${t.isOutOfStock})">
                            ${t.isOutOfStock ? '재입고' : '다 씀'}
                        </button>
                        <button class="btn-delete" onclick="deleteThread(${t.row})">삭제</button>
                    </div>
                </td>
            `;
            listContainer.appendChild(tr);
        });
    }
}

document.getElementById('filter-brand').addEventListener('change', renderList);
document.getElementById('filter-type').addEventListener('change', renderList);

loadThreads();
