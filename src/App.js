import React, { useState, useEffect } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  doc,
  updateDoc,
  query,
  orderBy,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "./firebase";
import {
  Shield,
  Upload,
  CheckCircle2,
  Search,
  ArrowRight,
  Loader2,
} from "lucide-react";

export default function App() {
  const [view, setView] = useState("order"); // 'order', 'status', 'admin'
  const [orders, setOrders] = useState([]);
  const [settings, setSettings] = useState({
    bankName: "ธนาคารกสิกรไทย (KBANK)",
    accountNo: "224-8-20465-9",
    accountName: "ภาคิน ส่งศรีบุญสิทธิ์",
    shirt1Img:
      "https://firebasestorage.googleapis.com/v0/b/siriraj-fc-orders.firebasestorage.app/o/shirt1.jpg?alt=media&token=ab21b557-2f98-4578-859f-f4250e4bf8bb",
    shirt2Img:
      "https://firebasestorage.googleapis.com/v0/b/siriraj-fc-orders.firebasestorage.app/o/shirt2.jpg?alt=media&token=fc85e1fe-0493-409c-ab06-db209016a883",
    qrImg:
      "https://firebasestorage.googleapis.com/v0/b/siriraj-fc-orders.firebasestorage.app/o/QR%20code.jpg?alt=media&token=4fefb9c2-e528-4ec6-861e-e8a7e2e7fdf3",
  });

  useEffect(() => {
    const unsubOrders = onSnapshot(
      query(collection(db, "orders"), orderBy("timestamp", "desc")),
      (snap) => {
        setOrders(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      }
    );
    const unsubSettings = onSnapshot(
      doc(db, "settings", "config"),
      (docSnap) => {
        if (docSnap.exists()) setSettings(docSnap.data());
      }
    );
    return () => {
      unsubOrders();
      unsubSettings();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090b] text-white p-4 font-sans">
      <header className="max-w-4xl mx-auto flex justify-between items-center py-4 border-b border-zinc-800 mb-8">
        <h1 className="text-2xl font-black text-lime-400 italic">SIRIRAJ FC</h1>
        <div className="flex gap-4 items-center">
          <button
            onClick={() => setView("order")}
            className={`text-sm ${
              view === "order" ? "text-lime-400 font-bold" : "text-zinc-400"
            }`}
          >
            สั่งเสื้อ
          </button>
          <button
            onClick={() => setView("status")}
            className={`text-sm ${
              view === "status" ? "text-lime-400 font-bold" : "text-zinc-400"
            }`}
          >
            เช็คสถานะ
          </button>
          <button
            onClick={() => setView("admin")}
            className="p-2 bg-zinc-800 rounded-lg hover:bg-lime-500 hover:text-black transition"
          >
            <Shield size={16} />
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto">
        {view === "order" && <OrderForm orders={orders} settings={settings} />}
        {view === "status" && <StatusCheck orders={orders} />}
        {view === "admin" && <AdminPanel orders={orders} settings={settings} />}
      </main>
    </div>
  );
}

function OrderForm({ orders, settings }) {
  const [step, setStep] = useState(1);
  const [showGrid, setShowGrid] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    surname: "",
    nickname: "",
    studentId: "",
    phone: "",
    size: "",
    jerseyNumber: "",
    screenName: "",
  });
  const [slip, setSlip] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [warnings, setWarnings] = useState({});

  // ส่วนตรวจสอบความถูกต้องของข้อมูล (Validation)
  useEffect(() => {
    let newWarnings = {};

    // 1. ตรวจสอบรหัสนิสิต (7 หลัก)
    if (formData.studentId && !/^\d{7}$/.test(formData.studentId))
      newWarnings.studentId = "รหัสนิสิตต้องมี 7 หลัก";
    if (
      formData.studentId &&
      orders.some((o) => o.studentId === formData.studentId)
    )
      newWarnings.studentId = "รหัสนิสิตนี้ลงทะเบียนเรียบร้อยแล้ว";

    // 2. ตรวจสอบชื่อสกรีน (ภาษาอังกฤษเท่านั้น)
    if (formData.screenName && !/^[A-Za-z\s]+$/.test(formData.screenName))
      newWarnings.screenName = "ต้องเป็นภาษาอังกฤษเท่านั้น";

    // 3. ตรวจสอบเบอร์เสื้อ (ห้ามขึ้นต้นด้วย 0 และต้องไม่เกิน 2 หลัก)
    if (formData.jerseyNumber) {
      // Regex: ^[1-9] คือเริ่มด้วย 1-9, \d{0,1}$ คือตามด้วยตัวเลขอีก 0 หรือ 1 ตัว
      if (!/^[1-9]\d{0,1}$/.test(formData.jerseyNumber)) {
        newWarnings.jerseyNumber = "เบอร์เสื้อ 1-99 (ห้ามขึ้นต้นด้วย 0)";
      } else if (orders.some((o) => o.jerseyNumber === formData.jerseyNumber)) {
        newWarnings.jerseyNumber = "มีคนเลือกเบอร์นี้แล้ว";
      }
    }

    // 4. ตรวจสอบเบอร์โทรศัพท์ (0xx, 10 หลัก)
    if (formData.phone) {
      if (!/^0\d*$/.test(formData.phone)) {
        newWarnings.phone = "เบอร์โทรศัพท์ต้องขึ้นต้นด้วยเลข 0 เท่านั้น";
      } else if (!/^\d{10}$/.test(formData.phone)) {
        newWarnings.phone = "เบอร์โทรศัพท์ต้องมี 10 หลัก";
      }
    }

    setWarnings(newWarnings);
  }, [formData, orders]);

  const isValid =
    Object.keys(warnings).length === 0 &&
    Object.values(formData).every((v) => v.trim() !== "");

  const submitOrder = async () => {
    if (!slip) return alert("กรุณาแนบสลิป");
    setIsSubmitting(true);
    try {
      const slipRef = ref(
        storage,
        `slips/${formData.studentId}_${Date.now()}.jpg`
      );
      await uploadBytes(slipRef, slip);
      const slipUrl = await getDownloadURL(slipRef);

      const orderData = {
        ...formData,
        slipUrl,
        status: "Pending",
        timestamp: new Date().toISOString(),
      };
      await addDoc(collection(db, "orders"), orderData);
      setStep(4);
    } catch (err) {
      alert("เกิดข้อผิดพลาด: " + err.message);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
      {/* --- ส่วนที่เพิ่มเข้ามา: Popup แจ้งเตือนการอัปโหลด --- */}
      {isSubmitting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-lime-500 p-8 rounded-2xl flex flex-col items-center gap-4 shadow-2xl">
            <Loader2 className="animate-spin text-lime-400" size={48} />
            <p className="text-lg font-bold text-white">
              กรุณารอสักครู่ ระบบกำลังดำเนินการ...
            </p>
          </div>
        </div>
      )}
      {/* ------------------------------------------------ */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="flex gap-4 justify-center mb-6">
            <img
              src={settings.shirt1Img}
              alt="Home"
              className="w-32 h-40 object-cover rounded border border-lime-500/30"
            />
            <img
              src={settings.shirt2Img}
              alt="Away"
              className="w-32 h-40 object-cover rounded border border-lime-500/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <input
              placeholder="ชื่อ"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white"
            />
            <input
              placeholder="นามสกุล"
              value={formData.surname}
              onChange={(e) =>
                setFormData({ ...formData, surname: e.target.value })
              }
              className="p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white"
            />
            <input
              placeholder="ชื่อเล่น"
              value={formData.nickname}
              onChange={(e) =>
                setFormData({ ...formData, nickname: e.target.value })
              }
              className="p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white"
            />

            {/* กล่องกรอกเบอร์โทรศัพท์พร้อมแสดงข้อความแจ้งเตือน */}
            <div className="flex flex-col">
              <input
                placeholder="เบอร์โทรศัพท์ (0xx...)"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                className="p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white"
              />
            </div>
          </div>

          {/* ขยับส่วนแจ้งเตือนเบอร์โทรศัพท์มาแสดงตรงนี้เพื่อให้เห็นชัดเจน */}
          {warnings.phone && (
            <p className="text-red-500 text-sm -mt-2">{warnings.phone}</p>
          )}

          <div>
            <input
              placeholder="รหัสนิสิต (7 หลัก)"
              value={formData.studentId}
              onChange={(e) =>
                setFormData({ ...formData, studentId: e.target.value })
              }
              className="w-full p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white"
            />
            {warnings.studentId && (
              <p className="text-red-500 text-sm mt-1">{warnings.studentId}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <select
              value={formData.size}
              onChange={(e) =>
                setFormData({ ...formData, size: e.target.value })
              }
              className="p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white"
            >
              <option value="" disabled selected>
                -- เลือกไซส์เสื้อ --
              </option>
              <option value="SS">SS/อก36นิ้ว/ยาว25นิ้ว</option>
              <option value="S">S/อก38นิ้ว/ยาว26นิ้ว</option>
              <option value="M">M/อก40นิ้ว/ยาว27นิ้ว</option>
              <option value="L">L/อก42นิ้ว/ยาว28นิ้ว</option>
              <option value="XL">XL/อก44นิ้ว/ยาว29นิ้ว</option>
              <option value="2XL">2XL/อก46นิ้ว/ยาว30นิ้ว</option>
              <option value="3XL">3XL/อก48นิ้ว/ยาว31นิ้ว</option>
              <option value="4XL">4XL/อก50นิ้ว/ยาว32นิ้ว</option>
              <option value="5XL">5XL/อก52นิ้ว/ยาว33นิ้ว</option>
            </select>
            {/* --- วางโค้ดก้อนนี้แทนที่ของเดิม --- */}
            <div className="col-span-2">
              <div className="flex gap-2">
                <input
                  placeholder="เบอร์เสื้อ (1-99)"
                  value={formData.jerseyNumber}
                  onChange={(e) =>
                    setFormData({ ...formData, jerseyNumber: e.target.value })
                  }
                  className="w-full p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowGrid(!showGrid)}
                  className="px-3 py-2 bg-zinc-800 rounded border border-zinc-700 hover:bg-zinc-700 text-white text-sm whitespace-nowrap"
                >
                  {showGrid ? "ปิดตาราง" : "ดูเบอร์ว่าง"}
                </button>
              </div>

              {/* ตารางเบอร์เสื้อ */}
              {showGrid && (
                <div className="grid grid-cols-10 gap-1 p-3 bg-black rounded-xl border border-zinc-700 mt-2">
                  {Array.from({ length: 99 }, (_, i) => i + 1).map((num) => {
                    // ถ้าเบอร์นี้มีคนเลือกไปแล้ว และสถานะไม่ใช่ "ไม่อนุมัติ" (Rejected) ให้ถือว่าถูกจองแล้ว
                    const isTaken = orders.some(
                      (o) =>
                        parseInt(o.jerseyNumber) === num &&
                        o.status !== "Rejected"
                    );
                    return (
                      <button
                        type="button"
                        key={num}
                        disabled={isTaken}
                        onClick={() => {
                          setFormData({
                            ...formData,
                            jerseyNumber: num.toString(),
                          });
                          setShowGrid(false);
                        }}
                        className={`text-[10px] p-1 rounded transition ${
                          isTaken
                            ? "bg-red-900/40 text-red-700 cursor-not-allowed"
                            : "bg-green-900/40 text-green-400 hover:bg-green-500 hover:text-black"
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              )}

              {warnings.jerseyNumber && (
                <p className="text-red-500 text-sm mt-1">
                  {warnings.jerseyNumber}
                </p>
              )}
            </div>
            {/* ------------------------------- */}
          </div>

          <div>
            <input
              placeholder="ชื่อสกรีน (ภาษาอังกฤษ)"
              value={formData.screenName}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  screenName: e.target.value.toUpperCase(),
                })
              }
              className="w-full p-3 bg-zinc-950 rounded border border-zinc-800 focus:border-lime-500 outline-none text-white uppercase"
            />
            {warnings.screenName && (
              <p className="text-red-500 text-sm mt-1">{warnings.screenName}</p>
            )}
          </div>

          <button
            onClick={() => setStep(2)}
            disabled={!isValid}
            className="w-full py-3 bg-lime-500 text-black font-bold rounded hover:bg-lime-400 disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      )}

      {/* step 2, 3, 4 คงเดิม */}
      {step === 2 && (
        <div className="text-center space-y-6">
          <h2 className="text-2xl font-bold text-lime-400">ยอดชำระ: 600 บาท</h2>
          {settings.qrImg ? (
            <img
              src={settings.qrImg}
              alt="QR Code"
              className="w-48 h-48 mx-auto rounded"
            />
          ) : (
            <div className="w-48 h-48 mx-auto bg-white flex items-center justify-center text-black">
              NO QR
            </div>
          )}
          <p className="text-xl">{settings.bankName}</p>
          <p className="text-2xl font-mono">{settings.accountNo}</p>
          <p className="text-zinc-400">{settings.accountName}</p>
          <button
            onClick={() => setStep(3)}
            className="w-full py-3 bg-lime-500 text-black font-bold rounded hover:bg-lime-400"
          >
            อัปโหลดสลิป
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-6">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSlip(e.target.files[0])}
            className="w-full p-8 border-2 border-dashed border-zinc-700 rounded bg-zinc-950"
          />
          <button
            onClick={submitOrder}
            disabled={!slip || isSubmitting}
            className="w-full py-3 bg-lime-500 text-black font-bold rounded hover:bg-lime-400 disabled:opacity-50 flex justify-center items-center gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="animate-spin" />
            ) : (
              "ยืนยันการสั่งซื้อ"
            )}
          </button>
        </div>
      )}

      {step === 4 && (
        <div className="text-center space-y-4 py-8">
          <CheckCircle2 size={64} className="text-lime-400 mx-auto" />
          <h2 className="text-2xl font-bold">สั่งซื้อสำเร็จ!</h2>
          <p className="text-zinc-400">อยู่ระหว่างตรวจสอบหลักฐานการโอนเงิน</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-6 py-2 bg-zinc-800 rounded"
          >
            กลับหน้าแรก
          </button>
        </div>
      )}
    </div>
  );
}

function StatusCheck({ orders }) {
  const [searchId, setSearchId] = useState("");
  const [searchPhone, setSearchPhone] = useState("");
  const [result, setResult] = useState(null);

  const checkStatus = (e) => {
    e.preventDefault();
    const found = orders.find(
      (o) => o.studentId === searchId && o.phone === searchPhone
    );
    setResult(found || "not_found");
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md mx-auto">
      <form onSubmit={checkStatus} className="space-y-4">
        <input
          placeholder="รหัสนิสิต"
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="w-full p-3 bg-zinc-950 rounded border border-zinc-800 outline-none text-white"
          required
        />
        <input
          placeholder="เบอร์โทรศัพท์"
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
          className="w-full p-3 bg-zinc-950 rounded border border-zinc-800 outline-none text-white"
          required
        />
        <button
          type="submit"
          className="w-full py-3 bg-lime-500 text-black font-bold rounded flex justify-center items-center gap-2"
        >
          <Search size={18} /> ตรวจสอบสถานะ
        </button>
      </form>

      {result && result !== "not_found" && (
        <div className="mt-6 p-4 bg-zinc-950 rounded border border-zinc-800 text-center">
          <p className="text-zinc-400 mb-2">สถานะของคุณ:</p>
          {result.status === "Approved" ? (
            <span className="px-4 py-2 bg-lime-500/20 text-lime-400 font-bold rounded-full">
              ตรวจสอบแล้ว (Approved)
            </span>
          ) : (
            <span className="px-4 py-2 bg-yellow-500/20 text-yellow-400 font-bold rounded-full">
              รอตรวจสอบ (Pending)
            </span>
          )}
        </div>
      )}
      {result === "not_found" && (
        <p className="mt-6 text-red-500 text-center">
          ไม่พบข้อมูล กรุณาตรวจสอบรหัสนิสิตและเบอร์โทร
        </p>
      )}
    </div>
  );
}

function AdminPanel({ orders, settings }) {
  const [isAuth, setIsAuth] = useState(false);
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // 1. คำนวณ Stats
  const totalOrders = orders.length;
  const totalRevenue = totalOrders * 600;

  // 2. คำนวณจำนวนงานในแต่ละ Tab
  const counts = {
    pending: orders.filter((o) => o.status === "Pending" || !o.status).length,
    approved: orders.filter((o) => o.status === "Approved").length,
    rejected: orders.filter((o) => o.status === "Rejected").length,
  };

  // 3. กรองข้อมูล (Tab + Search)
  const filteredOrders = orders.filter((order) => {
    const status = order.status || "Pending";
    const matchesTab =
      (activeTab === "pending" && status === "Pending") ||
      (activeTab === "approved" && status === "Approved") ||
      (activeTab === "rejected" && status === "Rejected");

    const matchesSearch =
      order.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.surname.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.studentId.includes(searchQuery);

    return matchesTab && matchesSearch;
  });

  const login = (e) => {
    e.preventDefault();
    if (password === "adminsirirajFC") setIsAuth(true);
    else alert("รหัสผ่านไม่ถูกต้อง");
  };

  const updateStatus = async (orderId, newStatus) => {
    await updateDoc(doc(db, "orders", orderId), { status: newStatus });
  };
  const exportToExcel = () => {
    const headers = [
      "ชื่อ",
      "นามสกุล",
      "ชื่อเล่น",
      "รหัสนิสิต",
      "เบอร์โทร",
      "ไซส์",
      "เบอร์เสื้อ",
      "ชื่อสกรีน",
      "สถานะ",
      "เวลาที่สั่ง",
    ];

    const csvData = orders.map((order) => {
      return [
        `"${order.name || ""}"`,
        `"${order.surname || ""}"`,
        `"${order.nickname || ""}"`,
        `"${order.studentId || ""}"`,
        `"${order.phone || ""}"`,
        `"${order.size || ""}"`,
        `"${order.jerseyNumber || ""}"`,
        `"${order.screenName || ""}"`,
        `"${order.status || "Pending"}"`,
        `"${new Date(order.timestamp).toLocaleString("th-TH")}"`,
      ].join(",");
    });

    const csvContent = [headers.join(","), ...csvData].join("\n");
    // ใส่ \uFEFF เพื่อให้ Excel อ่านภาษาไทยได้สมบูรณ์ (BOM)
    const blob = new Blob(["\uFEFF" + csvContent], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute(
      "download",
      `SirirajFC_Orders_${new Date().toISOString().split("T")[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  if (!isAuth) {
    return (
      <form
        onSubmit={login}
        className="max-w-sm mx-auto bg-zinc-900 p-6 rounded-2xl border border-zinc-800 space-y-4"
      >
        <h2 className="text-xl font-bold text-center text-white">
          Admin Login
        </h2>
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 bg-zinc-950 rounded border border-zinc-800 text-white"
        />
        <button
          type="submit"
          className="w-full py-3 bg-lime-500 text-black font-bold rounded"
        >
          Login
        </button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Dashboard สรุปยอด */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-400 text-sm">จำนวนผู้สั่งซื้อทั้งหมด</p>
          <p className="text-3xl font-black text-white">
            {totalOrders} <span className="text-lg text-zinc-500">คน</span>
          </p>
        </div>
        <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
          <p className="text-zinc-400 text-sm">ยอดเงินรวม</p>
          <p className="text-3xl font-black text-lime-400">
            {totalRevenue.toLocaleString()}{" "}
            <span className="text-lg text-zinc-500">บาท</span>
          </p>
        </div>
      </div>

      {/* 2. Search Box & Export Button */}
      <div className="flex gap-2">
        <input
          placeholder="🔍 ค้นหาชื่อ หรือ รหัสนิสิต..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 w-full p-3 bg-zinc-950 rounded-xl border border-zinc-700 text-white outline-none focus:border-lime-500"
        />
        <button
          onClick={exportToExcel}
          className="px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-xl whitespace-nowrap flex items-center gap-2 transition"
        >
          📥 Export Excel
        </button>
      </div>

      {/* 3. Tab นำทาง */}
      <div className="flex gap-2 border-b border-zinc-800 overflow-x-auto pb-1">
        {[
          { id: "pending", label: "รอตรวจสอบ", count: counts.pending },
          { id: "approved", label: "อนุมัติแล้ว", count: counts.approved },
          { id: "rejected", label: "ไม่อนุมัติ", count: counts.rejected },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 font-bold whitespace-nowrap flex items-center gap-2 ${
              activeTab === tab.id
                ? "text-lime-400 border-b-2 border-lime-500"
                : "text-zinc-500"
            }`}
          >
            {tab.label}
            <span
              className={`px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? "bg-lime-500/20 text-lime-400"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 4. รายการออเดอร์ */}
      <div className="space-y-3">
        {filteredOrders.length === 0 ? (
          <p className="text-center text-zinc-600 py-10">
            ไม่พบข้อมูลในรายการนี้
          </p>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="p-4 bg-zinc-950 rounded-xl border border-zinc-800 flex justify-between items-center"
            >
              <div>
                <p className="font-bold text-white">
                  {order.name} {order.surname}{" "}
                  <span className="text-zinc-500 text-sm">
                    ({order.studentId})
                  </span>
                </p>
                <p className="text-sm text-zinc-400">
                  เบอร์: {order.jerseyNumber} | Size: {order.size}
                </p>
                <a
                  href={order.slipUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-lime-400 text-sm underline"
                >
                  ดูสลิปโอนเงิน
                </a>
              </div>

              <div className="flex flex-col gap-2">
                {activeTab === "pending" && (
                  <>
                    <button
                      onClick={() => updateStatus(order.id, "Approved")}
                      className="bg-lime-500 text-black px-4 py-1.5 rounded-lg text-sm font-bold"
                    >
                      อนุมัติ
                    </button>
                    <button
                      onClick={() => updateStatus(order.id, "Rejected")}
                      className="bg-red-900/50 text-red-200 px-4 py-1.5 rounded-lg text-sm font-bold"
                    >
                      ไม่อนุมัติ
                    </button>
                  </>
                )}
                {(activeTab === "approved" || activeTab === "rejected") && (
                  <button
                    onClick={() => updateStatus(order.id, "Pending")}
                    className="bg-zinc-700 text-white px-4 py-1.5 rounded-lg text-sm font-bold"
                  >
                    ดึงกลับแก้ไข
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
