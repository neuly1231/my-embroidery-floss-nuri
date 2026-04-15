/**
 * 자수실 장부 - 통합 app.js
 * 1. 구글 스프레드시트 연동 (GAS)
 * 2. 중복 등록 원천 차단 (Batch 처리 및 로컬 필터링)
 * 3. 재고 관리 (다 씀 / 재입고 토글)
 * 4. 모바일 최적화 레이아웃 대응
 */
const GAS_URL = "https://script.google.com/macros/s/AKfycbyzZtb2MAnuBBZpb4MfiEanC5gOXRmrqIwHrnvLMIbPibCcX_NpIW02sknXQJkVHUnfhw/exec";
let threads = [];

/**
 * 1. 서버(시트)에서 전체 데이터 불러오기
 */
async function loadThreads() {
    try {
        const response = await fetch(GAS_URL);
        threads = await response.json();
        renderList();
    } catch (e) {
        console.error("데이터 로딩 중 에러 발생:", e);
    }
}

/**
 * 2. 자수실 추가 처리 (Batch 전송 및 중복 차단)
 */
const form = document.getElementById('add-form');
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const btn = form.querySelector('button');
    if (btn.disabled) return; // 전송 중 중복 클릭 방지

    const brand = document.getElementById('brand').value;
    const type = document.getElementById('type').value;
    const colorCodeInput = document.getElementById('colorCode').value;

    // 입력값 정제 및 입력 내 중복 제거 (예: 310, 310 방지)
    const rawCodes = colorCodeInput.split(',')
                                   .map(code => code.trim().toUpperCase())
                                   .filter(code => code !== '');
    const uniqueInputCodes = [...new Set(rawCodes)];

    if (uniqueInputCodes.length === 0) return;

    // UI 상태 업데이트 (로딩 중)
    btn.disabled = true;
    btn.textContent = "저장 중...";

    try {
        // 서버(GAS)에 묶음으로 전송
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: 'addBatch', 
                brand: brand, 
                type: type, 
                codes: uniqueInputCodes 
            })
        });
        
        // 입력창 초기화 및 최신 데이터 갱신
        document.getElementById('colorCode').value = '';
        await loadThreads();
    } catch (err) {
        alert("데이터 저장에 실패했습니다. 네트워크를 확인해주세요.");
        console.error(err);
    } finally {
        // UI 상태 복구
        btn.disabled = false;
        btn.textContent = "+ 추가";
        document.getElementById('colorCode').focus();
    }
});

/**
 * 3. 재고 상태 변경 (다 씀 / 재입고 토글)
 */
async function toggleStock(row, currentStatus) {
    try {
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: 'toggle', 
                row: row, 
                isOutOfStock: !currentStatus 
            })
        });
        await loadThreads();
    } catch (e) {
        alert("상태 변경 실패");
    }
}

/**
 * 4. 자수실 삭제 처리
 */
async function deleteThread(row) {
    if (!confirm("이 자수실을 장부에서 영구히 삭제하시겠습니까?")) return;
    try {
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: 'delete', 
                row: row 
            })
        });
        await loadThreads();
    } catch (e) {
        alert("삭제 실패");
    }
}

/**
 * 5. 제조사별 CSS 클래스 반환
 */
function getBrandClass(brand) {
    if (brand === 'DMC') return 'brand-DMC';
    if (brand === 'Anchor') return 'brand-Anchor';
    return 'brand-Appleton';
}

/**
 * 6. 상단 통계 배지 렌더링
 */
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

/**
 * 7. 메인 리스트 렌더링
 */
function renderList() {
    const listContainer = document.getElementById('thread-list');
    const emptyMessage = document.getElementById('empty-message');
    const threadTable = document.getElementById('thread-table');
    const filterBrand = document.getElementById('filter-brand').value;
    const filterType = document.getElementById('filter-type').value;

    listContainer.innerHTML = '';
    renderStats();

    // 필터링 로직
    const filtered = threads.filter(t => {
        const matchBrand = filterBrand === 'All' || t.brand === filterBrand;
        const matchType = filterType === 'All' || t.type === filterType;
        return matchBrand && matchType;
    });

    if (filtered.length === 0) {
        emptyMessage.style.display = 'block';
        threadTable.style.display = 'none';
        emptyMessage.querySelector('p').textContent = threads.length === 0 ? '아직 등록된 자수실이 없어요' : '조건에 맞는 자수실이 없어요';
    } else {
        emptyMessage.style.display = 'none';
        threadTable.style.display = 'table';
        
        filtered.forEach((thread) => {
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

// 필터 이벤트 바인딩
document.getElementById('filter-brand').addEventListener('change', renderList);
document.getElementById('filter-type').addEventListener('change', renderList);

// 초기화: 페이지 접속 시 데이터 로드
loadThreads();
