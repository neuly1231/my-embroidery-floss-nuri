const GAS_URL = "https://script.google.com/macros/s/AKfycbztrDzSZvK7boccLIT8pKlGmqjQvbugt_tNydy8lQvBRJa297-GWgqRAMxQiUGdGBTb/exec";
let threads = [];

// 1. 데이터 불러오기 (Read)
async function loadThreads() {
    try {
        const response = await fetch(GAS_URL);
        threads = await response.json();
        renderList();
    } catch (e) {
        console.error("데이터 로드 실패:", e);
    }
}

// 2. 데이터 추가 및 중복 체크 (Create/Update)
const form = document.getElementById('add-form');
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const brand = document.getElementById('brand').value;
    const type = document.getElementById('type').value;
    const colorCodeInput = document.getElementById('colorCode').value;

    // 입력값에서 중복 제거 및 포맷팅
    const rawCodes = colorCodeInput.split(',')
                                   .map(code => code.trim().toUpperCase())
                                   .filter(code => code !== '');
    const uniqueCodes = [...new Set(rawCodes)]; 

    // 버튼 비활성화 (연타 방지)
    const submitBtn = form.querySelector('button');
    submitBtn.disabled = true;
    submitBtn.textContent = "저장 중...";

    for (let code of uniqueCodes) {
        // 현재 로컬 데이터에서 중복 확인
        const existingIndex = threads.findIndex(t => t.brand === brand && t.colorCode === code);
        
        if (existingIndex !== -1) {
            const existing = threads[existingIndex];
            
            if (!existing.isOutOfStock) {
                // 이미 있고 재고도 있는 경우 -> 경고 후 건너뜀
                alert(`${code}번은 이미 보유 중인 실이라 건너뜁니다.`);
                continue; 
            } else {
                // 이미 있는데 '다 씀' 상태인 경우 -> 재입고 처리 (Update)
                await fetch(GAS_URL, {
                    method: "POST",
                    body: JSON.stringify({ action: 'toggle', row: existing.row, isOutOfStock: false })
                });
                threads[existingIndex].isOutOfStock = false; // 로컬 즉시 갱신
            }
        } else {
            // 완전히 새로운 실인 경우 -> 추가 (Create)
            await fetch(GAS_URL, {
                method: "POST",
                body: JSON.stringify({ action: 'add', brand, type, colorCode: code })
            });
            // 로컬 배열에 임시 추가 (다음 루프에서 중복 체크에 걸리도록)
            threads.push({ brand, type, colorCode: code, isOutOfStock: false, row: 9999 });
        }
    }

    document.getElementById('colorCode').value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = "+ 추가";
    
    await loadThreads(); // 최종적으로 서버와 데이터 동기화
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
    if (!confirm("이 자수실을 장부에서 완전히 삭제하시겠습니까?")) return;
    await fetch(GAS_URL, {
        method: "POST",
        body: JSON.stringify({ action: 'delete', row: row })
    });
    loadThreads();
}

// 필터 이벤트 리스너
document.getElementById('filter-brand').addEventListener('change', renderList);
document.getElementById('filter-type').addEventListener('change', renderList);

// 통계 렌더링
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

// 브랜드별 CSS 클래스 반환
function getBrandClass(brand) {
    if (brand === 'DMC') return 'brand-DMC';
    if (brand === 'Anchor') return 'brand-Anchor';
    return 'brand-Appleton';
}

// 목록 렌더링
function renderList() {
    const listContainer = document.getElementById('thread-list');
    const emptyMessage = document.getElementById('empty-message');
    const threadTable = document.getElementById('thread-table');

    listContainer.innerHTML = '';
    renderStats();

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
        emptyMessage.querySelector('p').textContent = threads.length === 0 ? '아직 등록된 자수실이 없어요' : '조건에 맞는 자수실이 없어요';
    } else {
        emptyMessage.style.display = 'none';
        threadTable.style.display = 'table';
        filtered.forEach((thread, i) => {
            const tr = document.createElement('tr');
            if (thread.isOutOfStock) tr.classList.add('is-empty');

            const statusBtn = thread.isOutOfStock 
                ? `<button class="btn-restock" onclick="toggleStock(${thread.row}, ${thread.isOutOfStock})">재입고</button>`
                : `<button class="btn-empty" onclick="toggleStock(${thread.row}, ${thread.isOutOfStock})">다 씀</button>`;

            tr.innerHTML = `
                <td><span class="brand-badge ${getBrandClass(thread.brand)}">${thread.brand}</span></td>
                <td><span class="type-tag">${thread.type}</span></td>
                <td><span class="color-code">${thread.colorCode}</span></td>
                <td>
                    <div class="action-group">
                        ${statusBtn}
                        <button class="btn-delete" onclick="deleteThread(${thread.row})">삭제</button>
                    </div>
                </td>
            `;
            listContainer.appendChild(tr);
        });
    }
}

// 페이지 로드 시 실행
loadThreads();
