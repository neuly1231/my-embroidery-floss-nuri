const GAS_URL = "https://script.google.com/macros/s/AKfycbztrDzSZvK7boccLIT8pKlGmqjQvbugt_tNydy8lQvBRJa297-GWgqRAMxQiUGdGBTb/exec";
let threads = [];

// 1. 서버(시트)에서 데이터 가져오기 (Read)
async function loadThreads() {
    try {
        const response = await fetch(GAS_URL);
        threads = await response.json();
        renderList();
    } catch (e) {
        console.error("데이터 로드 실패:", e);
    }
}

// 2. 데이터 추가 (Create)
const form = document.getElementById('add-form');
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const brand = document.getElementById('brand').value;
    const type = document.getElementById('type').value;
    const colorCodeInput = document.getElementById('colorCode').value;

    const colorCodes = colorCodeInput.split(',')
                                     .map(code => code.trim().toUpperCase())
                                     .filter(code => code !== '');

    for (let code of colorCodes) {
        // 중복 체크 (로컬에 로드된 데이터 기준)
        const exists = threads.find(t => t.brand === brand && t.colorCode === code && !t.isOutOfStock);
        if (exists) {
            alert(`${code}번은 이미 장부에 있습니다.`);
            continue;
        }

        // 서버에 POST 요청
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ action: 'add', brand, type, colorCode: code })
        });
    }

    document.getElementById('colorCode').value = '';
    loadThreads(); // 재로딩
});

// 3. 재고 토글 (Update)
async function toggleStock(row, currentStatus) {
    await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ 
            action: 'toggle', 
            row: row, 
            isOutOfStock: !currentStatus 
        })
    });
    loadThreads();
}

// 4. 삭제 (Delete)
async function deleteThread(row) {
    if (!confirm("이 자수실을 완전히 삭제할까요?")) return;
    await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: 'delete', row: row })
    });
    loadThreads();
}

// 필터 기능
document.getElementById('filter-brand').addEventListener('change', renderList);
document.getElementById('filter-type').addEventListener('change', renderList);

// 화면 렌더링 함수 (기존 UI 로직 그대로 활용)
function renderList() {
    const listContainer = document.getElementById('thread-list');
    const emptyMessage = document.getElementById('empty-message');
    const threadTable = document.getElementById('thread-table');
    const statsRow = document.getElementById('stats-row');

    listContainer.innerHTML = '';

    // 통계 업데이트
    const total = threads.length;
    const brands = [...new Set(threads.map(t => t.brand))];
    statsRow.innerHTML = `<div class="stat-badge">전체 <strong>${total}</strong>개</div>` +
        brands.map(b => `<div class="stat-badge">${b} <strong>${threads.filter(t => t.brand === b).length}</strong></div>`).join('');

    // 필터링
    const selectedBrand = document.getElementById('filter-brand').value;
    const selectedType = document.getElementById('filter-type').value;

    const filtered = threads.filter(t => {
        const mb = selectedBrand === 'All' || t.brand === selectedBrand;
        const mt = selectedType === 'All' || t.type === selectedType;
        return mb && mt;
    });

    if (filtered.length === 0) {
        emptyMessage.style.display = 'block';
        threadTable.style.display = 'none';
    } else {
        emptyMessage.style.display = 'none';
        threadTable.style.display = 'table';
        filtered.forEach((thread, i) => {
            const tr = document.createElement('tr');
            if (thread.isOutOfStock) tr.classList.add('is-empty');

            tr.innerHTML = `
                <td><span class="brand-badge brand-${thread.brand}">${thread.brand}</span></td>
                <td><span class="type-tag">${thread.type}</span></td>
                <td><span class="color-code">${thread.colorCode}</span></td>
                <td>
                    <div class="action-group">
                        <button class="${thread.isOutOfStock ? 'btn-restock' : 'btn-empty'}" 
                                onclick="toggleStock(${thread.row}, ${thread.isOutOfStock})">
                            ${thread.isOutOfStock ? '재입고' : '다 씀'}
                        </button>
                        <button class="btn-delete" onclick="deleteThread(${thread.row})">삭제</button>
                    </div>
                </td>
            `;
            listContainer.appendChild(tr);
        });
    }
}

// 초기 로딩
loadThreads();
