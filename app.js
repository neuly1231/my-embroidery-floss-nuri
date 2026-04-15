const GAS_URL = "https://script.google.com/macros/s/AKfycbyayiBWoD2qRY_JALIza5LSocCxUXuZ2bT2Z2rP79vIWHn406B7cCaBHQOW5TRWtsaWnQ/exec";
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
const searchInput = document.getElementById('search-input'); // 검색창 선언

form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = form.querySelector('button');
    if (btn.disabled) return;

    const brand = document.getElementById('brand').value;
    const type = document.getElementById('type').value;
    const colorCodeInput = document.getElementById('colorCode').value;

    const rawCodes = colorCodeInput.split(',')
                                   .map(code => code.trim().toUpperCase())
                                   .filter(code => code !== '');
    const uniqueInputCodes = [...new Set(rawCodes)];

    if (uniqueInputCodes.length === 0) return;

    btn.disabled = true;
    btn.textContent = "저장 중...";

    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: 'addBatch', 
                brand: brand, 
                type: type, 
                codes: uniqueInputCodes 
            })
        });
        
        const result = await response.json();
        if (result.duplicates && result.duplicates.length > 0) {
            alert(`[중복 안내]\n${result.duplicates.join(', ')} 번호는 이미 장부에 있어 재입고 처리되었습니다.`);
        }
        
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
    
    // 필터 값들 가져오기
    const fBrand = document.getElementById('filter-brand').value;
    const fType = document.getElementById('filter-type').value;
    const searchTerm = searchInput.value.trim().toUpperCase(); // 검색어

    listContainer.innerHTML = '';
    renderStats();

    // 통합 필터링 로직 (브랜드 + 종류 + 검색어)
    const filtered = threads.filter(t => {
        const matchBrand = (fBrand === 'All' || t.brand === fBrand);
        const matchType = (fType === 'All' || t.type === fType);
        const matchSearch = t.colorCode.includes(searchTerm); // 번호 포함 여부 체크
        return matchBrand && matchType && matchSearch;
    });

    if (filtered.length === 0) {
        emptyMessage.style.display = 'block';
        threadTable.style.display = 'none';
        emptyMessage.querySelector('p').textContent = searchTerm ? '검색 결과가 없어요' : '조건에 맞는 자수실이 없어요';
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

// 필터 및 검색 이벤트 리스너
document.getElementById('filter-brand').addEventListener('change', renderList);
document.getElementById('filter-type').addEventListener('change', renderList);
searchInput.addEventListener('input', renderList); // 검색창 입력 시마다 즉시 실행

loadThreads();
