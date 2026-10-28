// ==================== 1. ข้อมูลเริ่มต้น (ไม่เก็บเงินเดือนและค่าแรงต่อชั่วโมงเด็ดขาด) ====================
const DEFAULT_EMPLOYEES = [
    { id: "EMP001", name: "วรเมธ หมอนศรี", dept: "IT Infrastructure", pass: "1234" },
    { id: "EMP002", name: "กิตติพงศ์ พัฒนา", dept: "Network Admin", pass: "1234" }
];

let employees = JSON.parse(localStorage.getItem("ot_employees")) || DEFAULT_EMPLOYEES;
let adminPassword = localStorage.getItem("ot_admin_pass") || "admin1234";
let otLogs = JSON.parse(localStorage.getItem("ot_monthly_logs")) || [];
let currentUser = null;
let selectedSpecialRate = 1.3;
let lastCalculatedResult = null;

document.addEventListener("DOMContentLoaded", () => {
    const today = new Date().toISOString().slice(0, 7);
    document.getElementById("recordMonth").value = today;
    initFireflySnowParticles();
    renderEmployeeTable();
    renderOtLogs();
});

// ==================== 2. ระบบเข้าสู่ระบบ (Authentication) ====================
function handleLogin(e) {
    e.preventDefault();
    const id = document.getElementById("loginId").value.trim();
    const pass = document.getElementById("loginPassword").value.trim();

    if (id.toLowerCase() === "admin" && pass === adminPassword) {
        currentUser = { id: "admin", name: "System Administrator", role: "admin" };
        showView("adminView");
        renderEmployeeTable();
        renderOtLogs();
        return;
    }

    const emp = employees.find(u => u.id.toLowerCase() === id.toLowerCase() && u.pass === pass);
    if (emp) {
        currentUser = { ...emp, role: "employee" };
        document.getElementById("empDisplayName").textContent = emp.name;
        document.getElementById("empDisplayDept").textContent = `รหัส: ${emp.id} | แผนก: ${emp.dept}`;
        clearCalculatorMemory();
        renderEmployeePersonalLogs();
        showView("employeeView");
    } else {
        alert("รหัสพนักงาน หรือ รหัสผ่านไม่ถูกต้อง!");
    }
}

function logout() {
    clearCalculatorMemory();
    currentUser = null;
    document.getElementById("loginForm").reset();
    showView("loginView");
}

function showView(viewId) {
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.remove("active"));
    document.getElementById(viewId).classList.add("active");
}

function clearCalculatorMemory() {
    ["salary", "hourlyRate", "otSpecial", "ot15", "ot3"].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = "";
            el.classList.remove("modified");
        }
    });
    document.querySelectorAll(".mod-badge").forEach(b => b.classList.remove("visible"));
    document.getElementById("resultDetails").innerHTML = `
        <div class="empty-result-state">
            ✨ กรอกเงินเดือนและจำนวนชั่วโมงโอทีด้านซ้าย<br>แล้วกดปุ่ม <strong>"คำนวณโอที"</strong> เพื่อดูสรุปยอดเงินที่นี่
        </div>
    `;
    lastCalculatedResult = null;
}

// ==================== 3. ระบบเปลี่ยนรหัสผ่านด้วยตัวเอง & Pop-up ลืมรหัสผ่าน ====================
function openChangePasswordModal() {
    document.getElementById("changePasswordForm").reset();
    document.getElementById("changePasswordModal").classList.remove("hidden");
}

function closeChangePasswordModal() {
    document.getElementById("changePasswordModal").classList.add("hidden");
}

function handleChangePassword(e) {
    e.preventDefault();
    if (!currentUser) return;

    const oldPass = document.getElementById("oldPassword").value.trim();
    const newPass = document.getElementById("newPassword").value.trim();
    const confirmPass = document.getElementById("confirmNewPassword").value.trim();

    if (newPass !== confirmPass) {
        alert("⚠️ รหัสผ่านใหม่ และการยืนยันรหัสผ่านใหม่ไม่ตรงกัน!");
        return;
    }

    if (currentUser.role === "admin") {
        if (oldPass !== adminPassword) {
            alert("❌ รหัสผ่านเดิมของ Admin ไม่ถูกต้อง!");
            return;
        }
        adminPassword = newPass;
        localStorage.setItem("ot_admin_pass", adminPassword);
        alert("✅ เปลี่ยนรหัสผ่าน Admin สำเร็จเรียบร้อยแล้ว!");
        closeChangePasswordModal();
    } else {
        const empIndex = employees.findIndex(u => u.id.toLowerCase() === currentUser.id.toLowerCase());
        if (empIndex === -1 || employees[empIndex].pass !== oldPass) {
            alert("❌ รหัสผ่านเดิมของคุณไม่ถูกต้อง!");
            return;
        }
        employees[empIndex].pass = newPass;
        currentUser.pass = newPass;
        localStorage.setItem("ot_employees", JSON.stringify(employees));
        renderEmployeeTable();
        alert("✅ เปลี่ยนรหัสผ่านใหม่เรียบร้อยแล้ว!");
        closeChangePasswordModal();
    }
}

function openForgotModal() {
    document.getElementById("forgotPasswordModal").classList.remove("hidden");
}

function closeForgotModal() {
    document.getElementById("forgotPasswordModal").classList.add("hidden");
}

// ==================== 4. ฟังก์ชันลูกตา SVG Show/Hide และการแจ้งเตือนแก้ไขข้อมูล ====================
function togglePassword(inputId, btnElement) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const eyeOff = btnElement.querySelector(".icon-eye-off");
    const eyeOn = btnElement.querySelector(".icon-eye-on");

    if (input.type === "password") {
        input.type = "text";
        if (eyeOff) eyeOff.classList.add("hidden");
        if (eyeOn) eyeOn.classList.remove("hidden");
    } else {
        input.type = "password";
        if (eyeOff) eyeOff.classList.remove("hidden");
        if (eyeOn) eyeOn.classList.add("hidden");
    }
}

function markModified(inputElement, badgeId) {
    if (inputElement.value !== "") {
        inputElement.classList.add("modified");
        if (badgeId) document.getElementById(badgeId).classList.add("visible");
    } else {
        inputElement.classList.remove("modified");
        if (badgeId) document.getElementById(badgeId).classList.remove("visible");
    }
}

// ==================== 5. ระบบสลับเรท x1.1 / x1.3 & คำนวณโอที ====================
function selectSpecialRate(rate) {
    selectedSpecialRate = parseFloat(rate);
    const btn11 = document.getElementById("btnRate11");
    const btn13 = document.getElementById("btnRate13");
    const label = document.getElementById("dynamicOtLabel");
    const input = document.getElementById("otSpecial");

    if (rate === "1.1") {
        btn11.classList.add("active");
        btn13.classList.remove("active");
    } else {
        btn13.classList.add("active");
        btn11.classList.remove("active");
    }

    label.textContent = `OT x${rate} (ชั่วโมง):`;
    input.placeholder = `จำนวนชั่วโมง OT *${rate}`;
}

function handleSalaryInput(salaryInput) {
    markModified(salaryInput, "badge-salary");
    const salary = parseFloat(salaryInput.value) || 0;
    const hourlyField = document.getElementById("hourlyRate");
    const hourlyBadge = document.getElementById("badge-hourlyRate");

    if (salary > 0) {
        const hourly = (salary / 25) / 8;
        hourlyField.value = hourly.toFixed(2);
        hourlyField.classList.add("modified");
        hourlyBadge.classList.add("visible");
    } else {
        hourlyField.value = "";
        hourlyField.classList.remove("modified");
        hourlyBadge.classList.remove("visible");
    }
}

function calculateOT() {
    const rate = parseFloat(document.getElementById("hourlyRate").value) || 0;
    if (rate <= 0) {
        alert("กรุณากรอกช่องเงินเดือน เพื่อคำนวณค่าแรงต่อชั่วโมงก่อนครับ");
        return;
    }

    const hrsSpecial = parseFloat(document.getElementById("otSpecial").value) || 0;
    const hrs15 = parseFloat(document.getElementById("ot15").value) || 0;
    const hrs3 = parseFloat(document.getElementById("ot3").value) || 0;

    const paySpecial = rate * selectedSpecialRate * hrsSpecial;
    const pay15 = rate * 1.5 * hrs15;
    const pay3 = rate * 3.0 * hrs3;

    const totalHours = hrsSpecial + hrs15 + hrs3;
    const totalPay = paySpecial + pay15 + pay3;

    lastCalculatedResult = {
        specialRateLabel: `x${selectedSpecialRate}`,
        hrsSpecial,
        hrs15,
        hrs3,
        totalHours,
        totalPay
    };

    const detailsContainer = document.getElementById("resultDetails");
    detailsContainer.innerHTML = `
        <div class="result-item">
            <span>เรท OT x${selectedSpecialRate} (${hrsSpecial} ชั่วโมง)</span>
            <strong>${paySpecial.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</strong>
        </div>
        <div class="result-item">
            <span>เรท OT x1.5 (${hrs15} ชั่วโมง)</span>
            <strong>${pay15.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</strong>
        </div>
        <div class="result-item">
            <span>เรท OT x3.0 (${hrs3} ชั่วโมง)</span>
            <strong>${pay3.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</strong>
        </div>
        <div class="result-summary">
            <div class="result-item" style="border:none;">
                <span>⏱️ รวมชั่วโมงโอทีต่อสัปดาห์:</span>
                <strong>${totalHours} ชั่วโมง</strong>
            </div>
            <div class="result-item" style="border:none; align-items:center;">
                <span>💰 ยอดเงินโอทีสุทธิ:</span>
                <span class="total-pay-highlight">${totalPay.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท</span>
            </div>
        </div>
    `;
}

function saveOtRecordToAdmin() {
    if (!lastCalculatedResult) {
        alert("กรุณากดปุ่ม 'คำนวณโอที' ก่อนทำการบันทึกรายเดือนครับ");
        return;
    }
    const month = document.getElementById("recordMonth").value;
    if (!month) {
        alert("กรุณาเลือกเดือนที่ต้องการบันทึก");
        return;
    }

    const newRecord = {
        logId: Date.now(),
        month,
        empId: currentUser.id,
        empName: currentUser.name,
        dept: currentUser.dept,
        breakdown: `${lastCalculatedResult.specialRateLabel}: ${lastCalculatedResult.hrsSpecial} ชม. | x1.5: ${lastCalculatedResult.hrs15} ชม. | x3: ${lastCalculatedResult.hrs3} ชม.`,
        totalHours: lastCalculatedResult.totalHours,
        totalPay: lastCalculatedResult.totalPay
    };

    otLogs.unshift(newRecord);
    localStorage.setItem("ot_monthly_logs", JSON.stringify(otLogs));
    renderEmployeePersonalLogs();
    renderOtLogs();
    alert("✅ บันทึกรายการโอทีประจำเดือนเรียบร้อยแล้ว คุณสามารถตรวจสอบรายการได้ที่ตารางด้านล่างครับ");
}

function renderEmployeePersonalLogs() {
    const tbody = document.getElementById("empPersonalLogBody");
    if (!tbody || !currentUser) return;

    const myLogs = otLogs.filter(l => l.empId.toLowerCase() === currentUser.id.toLowerCase());

    if (myLogs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:#A3B3CC;">ยังไม่มีประวัติการบันทึกโอทีของคุณ</td></tr>`;
        return;
    }

    tbody.innerHTML = myLogs.map(log => `
        <tr>
            <td><strong>${log.month}</strong></td>
            <td>${log.breakdown}</td>
            <td>${log.totalHours} ชม.</td>
            <td class="green-amount">${log.totalPay.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td><button class="action-btn btn-del" onclick="deleteOtLog(${log.logId})">ลบ</button></td>
        </tr>
    `).join("");
}

// ==================== 6. ระบบจัดการสำหรับ ADMIN (เพิ่มปุ่มรีเซ็ทรหัสผ่าน & ซ่อนรหัสผ่าน) ====================
function switchAdminTab(tabId, btn) {
    document.querySelectorAll(".admin-tab-content").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.getElementById(tabId).classList.add("active");
    btn.classList.add("active");
}

function renderEmployeeTable() {
    const tbody = document.getElementById("empTableBody");
    if (!tbody) return;
    tbody.innerHTML = employees.map((emp, index) => `
        <tr>
            <td><strong>${emp.id}</strong></td>
            <td>${emp.name}</td>
            <td>${emp.dept}</td>
            <td>
                <div class="pass-cell-wrapper">
                    <input type="password" id="tablePass_${index}" class="table-pass-input" value="${emp.pass}" readonly>
                    <button type="button" class="mini-eye-btn" onclick="togglePassword('tablePass_${index}', this)" title="แสดง/ซ่อนรหัสผ่าน">
                        <svg class="icon-eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        </svg>
                        <svg class="icon-eye-on hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                    </button>
                </div>
            </td>
            <td>
                <button class="action-btn btn-edit" onclick="editEmployee(${index})">แก้ไข</button>
                <button class="action-btn btn-reset-row" onclick="quickResetEmployeePassword(${index})" title="รีเซ็ทรหัสเป็น 1234">รีเซ็ทรหัส</button>
                <button class="action-btn btn-del" onclick="deleteEmployee(${index})">ลบ</button>
            </td>
        </tr>
    `).join("");
}

function saveEmployee(e) {
    e.preventDefault();
    const editIdx = document.getElementById("editIndex").value;
    const empData = {
        id: document.getElementById("empIdInput").value.trim(),
        name: document.getElementById("empNameInput").value.trim(),
        dept: document.getElementById("empDeptInput").value.trim(),
        pass: document.getElementById("empPassInput").value.trim()
    };

    if (editIdx === "") {
        employees.push(empData);
    } else {
        employees[parseInt(editIdx)] = empData;
    }

    localStorage.setItem("ot_employees", JSON.stringify(employees));
    resetEmpForm();
    renderEmployeeTable();
}

function editEmployee(index) {
    const emp = employees[index];
    document.getElementById("editIndex").value = index;
    document.getElementById("empIdInput").value = emp.id;
    document.getElementById("empNameInput").value = emp.name;
    document.getElementById("empDeptInput").value = emp.dept;

    const passInput = document.getElementById("empPassInput");
    passInput.value = emp.pass;
    passInput.type = "password";

    document.getElementById("formTitle").textContent = `✏️ แก้ไขข้อมูลพนักงาน (${emp.id})`;
}

// ข้อ 1: ฟังก์ชันรีเซ็ทรหัสผ่านในฟอร์มแก้ไขข้อมูลพนักงาน
function resetPasswordInForm() {
    const editIdx = document.getElementById("editIndex").value;
    const passInput = document.getElementById("empPassInput");

    if (editIdx !== "") {
        const emp = employees[parseInt(editIdx)];
        if (confirm(`ต้องการรีเซ็ทรหัสผ่านของ ${emp.name} (${emp.id}) เป็นค่าเริ่มต้น "1234" ใช่หรือไม่?`)) {
            employees[parseInt(editIdx)].pass = "1234";
            passInput.value = "1234";
            localStorage.setItem("ot_employees", JSON.stringify(employees));
            renderEmployeeTable();
            alert(`✅ รีเซ็ทรหัสผ่านของ ${emp.id} เป็น "1234" เรียบร้อยแล้ว`);
        }
    } else {
        passInput.value = "1234";
        alert("💡 ตั้งค่ารหัสผ่านในช่องกรอกเป็นค่าเริ่มต้น '1234' แล้ว");
    }
}

// ฟังก์ชันรีเซ็ทรหัสผ่านด่วนจากตารางรายชื่อพนักงาน
function quickResetEmployeePassword(index) {
    const emp = employees[index];
    if (confirm(`ต้องการรีเซ็ทรหัสผ่านของ ${emp.name} (${emp.id}) เป็นค่าเริ่มต้น "1234" ทันทีใช่หรือไม่?`)) {
        employees[index].pass = "1234";
        localStorage.setItem("ot_employees", JSON.stringify(employees));
        renderEmployeeTable();
        if (document.getElementById("editIndex").value === String(index)) {
            document.getElementById("empPassInput").value = "1234";
        }
        alert(`✅ รีเซ็ทรหัสผ่านของ ${emp.id} เป็น "1234" เรียบร้อยแล้ว`);
    }
}

function deleteEmployee(index) {
    if (confirm("ต้องการลบรายชื่อพนักงานท่านนี้ใช่หรือไม่?")) {
        employees.splice(index, 1);
        localStorage.setItem("ot_employees", JSON.stringify(employees));
        renderEmployeeTable();
    }
}

function resetEmpForm() {
    document.getElementById("empForm").reset();
    document.getElementById("editIndex").value = "";
    document.getElementById("empPassInput").type = "password";
    document.getElementById("formTitle").textContent = "➕ เพิ่ม / แก้ไขข้อมูลพนักงาน";
}

function importEmployees() {
    const raw = document.getElementById("bulkImportText").value.trim();
    if (!raw) return alert("กรุณาวางข้อมูลก่อนกดนำเข้า");

    const lines = raw.split("\n");
    let count = 0;
    lines.forEach(line => {
        const parts = line.split(",").map(s => s.trim());
        if (parts.length >= 4) {
            employees.push({ id: parts[0], name: parts[1], dept: parts[2], pass: parts[3] });
            count++;
        }
    });

    localStorage.setItem("ot_employees", JSON.stringify(employees));
    document.getElementById("bulkImportText").value = "";
    renderEmployeeTable();
    alert(`⚡ นำเข้าข้อมูลพนักงานสำเร็จ ${count} รายการ`);
}

function renderOtLogs() {
    const tbody = document.getElementById("otLogTableBody");
    if (!tbody) return;
    const filterMonth = document.getElementById("filterMonth").value;
    const filtered = filterMonth ? otLogs.filter(l => l.month === filterMonth) : otLogs;

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#A3B3CC;">ยังไม่มีรายการบันทึกโอที</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(log => `
        <tr>
            <td>${log.month}</td>
            <td><strong>${log.empId}</strong></td>
            <td>${log.empName}</td>
            <td>${log.dept}</td>
            <td>${log.breakdown}</td>
            <td>${log.totalHours} ชม.</td>
            <td class="green-amount">${log.totalPay.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td><button class="action-btn btn-del" onclick="deleteOtLog(${log.logId})">ลบ</button></td>
        </tr>
    `).join("");
}

function deleteOtLog(logId) {
    if (!confirm("ต้องการลบรายการบันทึกโอทีนี้ใช่หรือไม่?")) return;
    otLogs = otLogs.filter(l => l.logId !== logId);
    localStorage.setItem("ot_monthly_logs", JSON.stringify(otLogs));
    renderOtLogs();
    renderEmployeePersonalLogs();
}

// ==================== 7. พื้นหลังหิ่งห้อย & ละอองหิมะ ขยับตามเมาส์ ====================
function initFireflySnowParticles() {
    const canvas = document.getElementById("particleCanvas");
    const ctx = canvas.getContext("2d");
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const mouse = { x: width / 2, y: height / 2, active: false };

    window.addEventListener("resize", () => {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    });

    window.addEventListener("mousemove", (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
        mouse.active = true;
    });

    const particles = Array.from({ length: 70 }, (_, i) => {
        const isFirefly = i % 3 === 0;
        return {
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: isFirefly ? (Math.random() - 0.5) * 0.5 : Math.random() * 0.6 + 0.2,
            r: isFirefly ? Math.random() * 2.5 + 1.2 : Math.random() * 2 + 0.8,
            isFirefly,
            phase: Math.random() * Math.PI * 2,
            speedPhase: Math.random() * 0.03 + 0.01
        };
    });

    function draw() {
        ctx.clearRect(0, 0, width, height);

        particles.forEach((p) => {
            p.phase += p.speedPhase;
            p.x += p.vx + Math.sin(p.phase) * 0.3;
            p.y += p.vy;

            if (mouse.active) {
                const dx = mouse.x - p.x;
                const dy = mouse.y - p.y;
                const dist = Math.hypot(dx, dy);

                if (dist < 220 && dist > 5) {
                    const force = (220 - dist) / 220;
                    if (p.isFirefly) {
                        p.x += (dx / dist) * force * 1.1;
                        p.y += (dy / dist) * force * 1.1;
                    } else {
                        p.x -= (dx / dist) * force * 0.6;
                        p.y += (dy / dist) * force * 0.4;
                    }
                }
            }

            if (p.x < -10) p.x = width + 10;
            if (p.x > width + 10) p.x = -10;
            if (p.y < -10) p.y = height + 10;
            if (p.y > height + 10) p.y = -10;

            const alpha = (Math.sin(p.phase) + 1) / 2 * 0.55 + 0.2;

            ctx.save();
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);

            if (p.isFirefly) {
                ctx.shadowBlur = 12;
                ctx.shadowColor = "rgba(243, 198, 119, 0.7)";
                ctx.fillStyle = `rgba(253, 230, 138, ${alpha})`;
            } else {
                ctx.shadowBlur = 6;
                ctx.shadowColor = "rgba(186, 230, 253, 0.5)";
                ctx.fillStyle = `rgba(224, 242, 254, ${alpha * 0.85})`;
            }

            ctx.fill();
            ctx.restore();
        });

        requestAnimationFrame(draw);
    }
    draw();
}