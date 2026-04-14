/**
 * 자수실 장부 - 최적화 버전 (Optimistic UI + Caching)
 */

const GAS_URL = "여기에_구글_앱스_스크립트_URL을_넣으세요";
const CACHE_KEY = 'my_threads_cache';

// 1. 초기 데이터: 로컬 스토리지 캐시에서 먼저 불러와서 빈 화면 방지
let threads = JSON.parse(localStorage.getItem(CACHE_KEY)) || [];

const form = document.getElementById('add-form');
const listContainer = document.getElementById('thread-list');
const emptyMessage = document.getElementById('empty-message');
const threadTable = document.getElementById('thread-table');
const statsRow = document.getElementById('stats-row');
const filterBrand = document.getElementById('filter-brand');
const filterType = document.getElementById('filter-type');

/**
 * 서버에서 최신 데이터 가져오기 (Sync)
 */
async function loadThreads() {
    try {
        const response = await fetch(GAS_URL);
        const freshData = await response.json();
        
        // 서버 데이터로 교체 및 캐시 업데이트
        threads = freshData;
        localStorage.setItem(CACHE_KEY, JSON.stringify(threads));
        
        renderList();
    } catch (e) {
        console.error("데이터 동기화 실패:", e);
    }
}

/**
 * 데이터 추가 (Create) - 낙관적 업데이트 적용
 */
form.addEventListener('submit', async function(e) {
    e.preventDefault();
    const brand = document.getElementById('brand').value;
    const type = document.getElementById('type').value;
    const colorCodeInput = document.getElementById('colorCode').value;

    const colorCodes = colorCodeInput.split(',')
                                     .map(code => code.trim().toUpperCase())
                                     .filter(code => code !== '');

    if (colorCodes.length === 0) return;

    // 현재 화면에 즉시 반영하기 위한 임시 데이터 처리
    for (let code of colorCodes) {
        const isDuplicate = threads.find(t => t.brand === brand && t.colorCode === code && !t.isOutOfStock);
        
        if (isDuplicate) {
            alert(`${code}번은 이미 보유 중입니다.`);
            continue;
        }

        // 1. [Optimistic UI] 서버 응답 전 배열에 먼저 추가
        const tempThread = {
            row: null, // 서버에서 할당받기 전
            brand,
            type,
            colorCode: code,
            isOutOfStock: false,
            isPending: true // 전송 중 표시용 (필요시 스타일링 가능)
        };
        threads.push(tempThread);
    }

    // 2. 즉시 렌더링
    renderList();
    document.getElementById('colorCode').value = '';
    document.getElementById('colorCode').focus();

    // 3. 서버에 실제 데이터 전송 (비동기)
    try {
        for (let code of colorCodes) {
            await fetch(GAS_URL, {
                method: "POST",
                body: JSON.stringify({ action: 'add', brand, type, colorCode: code })
            });
        }
        // 전송 완료 후 실제 서버 데이터와 동기화
        loadThreads();
    } catch (e) {
        alert("저장 중 오류가 발생했습니다. 새로고침 후 다시 확인해주세요.");
    }
});

/**
 * 재고 상태 토글 (Update) - 낙관적 업데이트 적용
 */
async function toggleStock(row, currentStatus) {
    if (!row) return; // 아직 서버에 저장 안 된 데이터는 토글 불가

    // 1. [Optimistic UI] 로컬 상태 즉시 변경
    const target = threads.find(t => t.row === row);
    if (target) {
        target.isOutOfStock = !currentStatus;
        renderList();
    }

    // 2. 서버 전송
    try {
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ 
                action: 'toggle', 
                row: row, 
                isOutOfStock: !currentStatus 
            })
        });
        // 굳이 loadThreads()를 호출하지 않아도 되지만, 데이터 정합성을 위해 호출
        loadThreads();
    } catch (e) {
        console.error("상태 변경 실패");
    }
}

/**
 * 데이터 삭제 (Delete) - 낙관적 업데이트 적용
 */
async function deleteThread(row) {
    if (!row) return;
    if (!confirm("이 자수실을 장부에서 삭제하시겠습니까?")) return;

    // 1. [Optimistic UI] 로컬에서 즉시 삭제
    threads = threads.filter(t => t.row !== row);
    renderList();

    // 2. 서버 전송
    try {
        await fetch(GAS_URL, {
            method: "POST",
            body: JSON.stringify({ action: 'delete', row: row })
        });
        loadThreads();
    } catch (e) {
        console.error("삭제 실패");
    }
}

/**
 * 통계 렌더링
 */
function renderStats() {
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
 * 브랜드별 CSS 클래스 리턴
 */
function getBrandClass(brand) {
    if (brand === 'DMC') return 'brand-DMC';
    if (brand === 'Anchor') return 'brand-Anchor';
    return 'brand-Appleton';
}

/**
 * 목록 UI 렌더링
 */
function renderList() {
    listContainer.innerHTML = '';
    renderStats();

    const selectedBrand = filterBrand.value;
    const selectedType = filterType.value;

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
            
            // row가 없는 경우(전송 중) 버튼 비활성화 처리
            const isPending = thread.row === null;
            const statusBtn = thread.isOutOfStock 
                ? `<button class="btn-restock" onclick="toggleStock(${thread.row}, ${thread.isOutOfStock})" ${isPending ? 'disabled' : ''}>재입고</button>`
                : `<button class="btn-empty" onclick="toggleStock(${thread.row}, ${thread.isOutOfStock})" ${isPending ? 'disabled' : ''}>다 씀</button>`;

            tr.innerHTML = `
                <td><span class="brand-badge ${getBrandClass(thread.brand)}">${thread.brand}</span></td>
                <td><span class="type-tag">${thread.type}</span></td>
                <td><span class="color-code">${thread.colorCode}</span></td>
                <td>
                    <div class="action-group">
                        ${statusBtn}
                        <button class="btn-delete" onclick="deleteThread(${thread.row})" ${isPending ? 'disabled' : ''}>삭제</button>
                    </div>
                </td>
            `;
            listContainer.appendChild(tr);
        });
    }
}

// 필터 이벤트 리스너
filterBrand.addEventListener('change', renderList);
filterType.addEventListener('change', renderList);

// 앱 시작점
renderList();    // 1. 캐시 데이터로 즉시 렌더링
loadThreads();   // 2. 백그라운드에서 서버 최신 데이터 동기화
