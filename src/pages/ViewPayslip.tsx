import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

const EmployeePayslipViewer = () => {
  const [month, setMonth] = useState("");
  const [payslipHTML, setPayslipHTML] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");

  const fetchPayslip = async (uid, selectedMonth) => {
    setLoading(true);
    try {
      const docRef = doc(db, "salaryDetails", `${uid}_${selectedMonth}`);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        const data = snap.data();
        console.log("HTML:", data.payslipHTML); // ✅ debug line
        setPayslipHTML(data.payslipHTML);
      } else {
        alert("Payslip not found for selected month.");
        setPayslipHTML("");
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching payslip.");
    }
    setLoading(false);
  };

  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
        if (month) fetchPayslip(user.uid, month);
      }
    });
    return () => unsubscribe();
  }, [month]);

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold text-blue-700 mb-4 text-center">
        View My Payslip
      </h2>

      <input
        type="month"
        className="w-full border p-2 mb-4 rounded"
        value={month}
        onChange={(e) => setMonth(e.target.value)}
      />

      {loading && <p className="text-center">Loading payslip...</p>}

      {!loading && payslipHTML && (
        <div
          className="mt-6"
          dangerouslySetInnerHTML={{ __html: payslipHTML }}
        />
      )}
    </div>
  );
};

export default EmployeePayslipViewer;
