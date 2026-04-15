// 1. 설정 (본인의 구글 앱스 스크립트 URL을 넣으세요)
const GAS_URL = "https://script.google.com/macros/s/AKfycbztrDzSZvK7boccLIT8pKlGmqjQvbugt_tNydy8lQvBRJa297-GWgqRAMxQiUGdGBTb/exec";
let threads = [];

// 2. 데이터 로드 (Read)
async function loadThreads() {
    try {
        const response = await fetch(GAS_URL);
        threads = await response.json();
        renderList();
    } catch (e) {
        console.error("데이터 로드 실패:", e);
    }
}

// 3. 실 추가 및 중복 처리 (Create / Update)
const form = document.getElementById('add-form');
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const brand = document.getElementById('brand').value;
    const type = document.getElementById('type').value;
    const colorCodeInput = document.getElementById('colorCode').value;

    // 입력값 파싱 및 자체 중복 제거 (Set 사용)
    const rawCodes = colorCodeInput.split(',')
                                   .map(code => code.trim().toUpperCase())
                                   .filter(code => code !== '');
    const uniqueInputCodes = [...new Set(rawCodes)];

    for (let code of uniqueInputCodes) {
        // 현재 로컬 데이터에서 동일한 제조사+번호가 있는지 확인
        const existingIndex = threads.findIndex(t => t.brand === brand && t.colorCode === code);
        const existingThread = threads[existingIndex];

        if (existingThread) {
            if (existingThread.isOutOfStock) {
                // [Case 1] 이미 있지만 '다 씀' 상태인 경우 -> 자동으로 '재입고'
                await fetch(GAS_URL, {
                    method: "POST",
                    body: JSON.stringify({ 
                        action: 'toggle', 
                        row: existingThread.row, 
                        isOutOfStock: false 
                    })
                });
                // 로컬 상태 즉시 갱신 (다음 루프 중복 체크용)
                threads[existingIndex].isOutOfStock = false;
            } else {
                // [Case 2] 이미 있고 재고도 있는 경우 -> 중복 알림 후 스킵
                alert(`[${brand}] ${code}번은 이미 목록에 있습니다.`);
                continue;
            }
        } else {
            // [Case 3] 아예 없는 신규 실인 경우 -> 추가
            await fetch(GAS_URL, {
                method: "POST",
                body: JSON.stringify({ action: 'add', brand, type, colorCode: code })
            });
            // 로컬 상태 즉시 갱신 (row는 임시 0, loadThreads에서 갱신됨)
            threads.push({ row: 0, brand, type, colorCode: code, isOutOfStock: false });
        }
    }

    document.getElementById('colorCode').value = '';
    document.getElementById('colorCode').focus();
    await loadThreads(); // 최종 상태 서버와 동기화
});

// 4. 재고 상태 토글 (Update)
async function toggleStock(row, currentStatus) {
    await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ 
            action: 'toggle', 
            row: row, 
            isOutOfStock: !currentStatus 
        })
    });
    await loadThreads();
}

// 5. 삭제 (Delete)
async function deleteThread(row) {
    if (!confirm("이 자수실을 장부에서 삭제하시겠습니까?")) return;
    await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: 'delete', row: row })
    });
    await loadThreads();
}

// 6. 브랜드별 CSS 클래스 매핑
function getBrandClass(brand) {
    if (brand === 'DMC') return 'brand-DMC';
    if (brand === 'Anchor') return 'brand-Anchor';
    return 'brand-Appleton';
}

// 7. 통계 렌더링
function renderStats() {
    const statsRow = document.getElementById('stats-row');
    const total = threads.length;
    const brands = [...new Set(threads.map(t => t.brand))];
    
    statsRow.innerHTML = `
        <div class="stat-badge">전체 <strong>${total}</strong>개</div>
        ${brands.map(b => `
            <div class="stat-badge">${b} <strong>${threads.filter(t => t.brand === b).length}</strong></div>
        `).join('')}
    `;
}

// 8. 목록 렌더링
function renderList() {
    const listContainer = document.getElementById('thread-list');
    const emptyMessage = document.getElementById('empty-message');
    const threadTable = document.getElementById('thread-table');
    const filterBrand = document.getElementById('filter-brand').value;
    const filterType = document.getElementById('filter-type').value;

    listContainer.innerHTML = '';
    renderStats();

    const filtered = threads.filter(t => {
        const mb = filterBrand === 'All' || t.brand === filterBrand;
        const mt = filterType === 'All' || t.type === filterType;
        return mb && mt;
    });

    if (filtered.length === 0) {
        emptyMessage.style.display = 'block';
        threadTable.style.display = 'none';
        emptyMessage.querySelector('p').textContent = threads.length === 0 ? '아직 등록된 자수실이 없어요' : '조건에 맞는 자수실이 없어요';
    } else {
        emptyMessage.style.display = 'none';
        threadTable.style.display = 'table';
        
        filtered.forEach((thread, i) => {
            const tr = document.createElement('tr');
            if (thread.isOutOfStock) tr.classList.add('is-empty');

            tr.innerHTML = `
                <td><span class="brand-badge ${getBrandClass(thread.brand)}">${thread.brand}</span></td>
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

// 필터 이벤트 리스너
document.getElementById('filter-brand').addEventListener('change', renderList);
document.getElementById('filter-type').addEventListener('change', renderList);

// 초기 실행
loadThreads();
