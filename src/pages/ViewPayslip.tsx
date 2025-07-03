import React, { useEffect, useState } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ViewPayslip = () => {
  const [user, setUser] = useState(null);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [payslip, setPayslip] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchPayslip = async () => {
      if (!user || !month) return;
      const docRef = doc(db, "salaryDetails", `${user.uid}_${month}`);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setPayslip(snap.data());
      } else {
        setPayslip(null);
      }
    };
    fetchPayslip();
  }, [user, month]);
  const downloadPayslipAsPDF = () => {
    if (!payslip) return;

    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.text("Payslip - " + payslip.month, 105, 15, { align: "center" });

    doc.setFontSize(10);
    doc.text("Enkonix Software Services", 105, 22, { align: "center" });
    doc.text("21023 Pearson Point Road, Gateway Avenue", 105, 27, {
      align: "center",
    });

    // Personal Info
    autoTable(doc, {
      startY: 35,
      head: [["Employee Info", "Value"]],
      body: [
        ["Name", payslip.name],
        ["Email", payslip.email],
        ["Phone", String(payslip.phone)],
        ["Department", payslip.department],
        ["Joining Date", payslip.joiningDate || "-"],
        ["Pay Period", payslip.month],
        ["Worked Hours", payslip.totalWorkedHours?.toFixed(2) + " hrs"],
        ["Present Days", String(payslip.presentDays)],
        ["Absent Days", String(payslip.absentDays)],
        ["Leaves Taken", String(payslip.leavesTaken)],
      ],
    });

    // Earnings Table
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Earnings", "Amount (₹)"]],
      body: [
        ["Basic", payslip.basicSalary],
        ["HRA", payslip.houseRentAllowance],
        ["DA", payslip.dearnessAllowance],
        ["Conveyance", payslip.conveyanceAllowance],
        ["Medical", payslip.medicalAllowance],
        ["Special Allowance", payslip.specialAllowance],
        ["Overtime", payslip.overtimePay],
        ["Incentives", payslip.incentives],
        ["Other Allowances", payslip.otherAllowances],
        ["Gross Salary", payslip.grossSalary?.toFixed(2)],
      ],
    });

    // Deductions Table
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Deductions", "Amount (₹)"]],
      body: [
        ["Tax", payslip.tax?.toFixed(2)],
        [
          `Penalty (${payslip.absentDays || 0} Days)`,
          payslip.penalty?.toFixed(2),
        ],
        [
          "Total Deductions",
          (
            parseFloat(payslip.tax || 0) + parseFloat(payslip.penalty || 0)
          ).toFixed(2),
        ],
      ],
    });

    // Bank Info
    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 10,
      head: [["Bank & Account Details", "Value"]],
      body: [
        ["Account Holder Name", payslip.accountHolderName || "-"],
        ["Account Number", payslip.accountNumber || "-"],
        ["Bank Name", payslip.bankName || "-"],
        ["IFSC Code", payslip.ifscCode || "-"],
        ["PAN", payslip.panNumber || "-"],
        ["ESIC", payslip.esicNumber || "N/A"],
        ["UAN", payslip.uan || "N/A"],
      ],
    });

    // Net Pay
    doc.setFontSize(12);
    doc.text(
      `Net Salary: ₹${payslip.netSalary?.toFixed(2)} (${
        payslip.netSalaryInWords || ""
      })`,
      20,
      doc.lastAutoTable.finalY + 15
    );

    doc.setFontSize(9);
    doc.text(
      "This is a system-generated payslip.",
      20,
      doc.lastAutoTable.finalY + 25
    );

    doc.save(`Payslip_${payslip.name}_${payslip.month}.pdf`);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-2xl shadow-md mt-6">
      <h2 className="text-2xl font-bold mb-4 text-center">Your Payslip</h2>

      <div className="mb-4">
        <label className="font-semibold">Select Month</label>
        <input
          type="month"
          className="w-full p-2 border rounded"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      {payslip ? (
        <div className="bg-white border border-gray-300 p-6 rounded-2xl shadow">
          <h3 className="text-3xl font-bold text-center mb-2">Payslip</h3>
          <p className="text-center text-sm text-gray-500">
            Enkonix Software Services
          </p>
          <p className="text-center text-sm text-gray-500 mb-6">
            21023 Pearson Point Road, Gateway Avenue
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p>
                <strong>Date of Joining:</strong> {payslip.joiningDate || "-"}
              </p>
              <p>
                <strong>Pay Period:</strong> {payslip.month}
              </p>
              <p>
                <strong>Total Working Days:</strong>{" "}
                {payslip.totalWorkingDays || 0}
              </p>
              <p>
                <strong>Leaves Taken:</strong> {payslip.leavesTaken || 0}
              </p>
              <p>
                <strong>Present Days:</strong> {payslip.presentDays || 0}
              </p>
            </div>
            <div>
              <p>
                <strong>Employee Name:</strong> {payslip.name}
              </p>
              <p>
                <strong>Email:</strong> {payslip.email}
              </p>
              <p>
                <strong>Phone:</strong> {payslip.phone}
              </p>
              <p>
                <strong>Department:</strong> {payslip.department}
              </p>
              <p>
                <strong>Worked Hours:</strong>{" "}
                {payslip.totalWorkedHours?.toFixed(2)} hrs
              </p>
            </div>
          </div>

          {/* Earnings and Deductions */}
          <div className="grid grid-cols-2 gap-6">
            <table className="w-full border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 border">Earnings</th>
                  <th className="p-2 border">₹</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Basic", payslip.basicSalary],
                  ["HRA", payslip.houseRentAllowance],
                  ["DA", payslip.dearnessAllowance],
                  ["Conveyance", payslip.conveyanceAllowance],
                  ["Medical", payslip.medicalAllowance],
                  ["Special Allowance", payslip.specialAllowance],
                  ["Overtime", payslip.overtimePay],
                  ["Incentives", payslip.incentives],
                  ["Other", payslip.otherAllowances],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="p-2 border">{label}</td>
                    <td className="p-2 border">
                      {parseFloat(value || 0).toFixed(2)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-gray-100 font-bold">
                  <td className="p-2 border">Gross Salary</td>
                  <td className="p-2 border">
                    ₹{payslip.grossSalary?.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>

            <table className="w-full border border-gray-300">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 border">Deductions</th>
                  <th className="p-2 border">₹</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border">Tax</td>
                  <td className="p-2 border">{payslip.tax?.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="p-2 border">
                    Penalty for {payslip.absentDays || 0} Days
                  </td>
                  <td className="p-2 border">{payslip.penalty?.toFixed(2)}</td>
                </tr>
                <tr className="bg-gray-100 font-bold">
                  <td className="p-2 border">Total Deductions</td>
                  <td className="p-2 border">
                    ₹
                    {(
                      parseFloat(payslip.tax || 0) +
                      parseFloat(payslip.penalty || 0)
                    ).toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bank Info */}
          <div className="grid grid-cols-2 gap-6 mt-8">
            <table className="w-full border border-gray-300 text-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="p-2 border text-left" colSpan={2}>
                    Bank & Account Details
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Account Holder Name", payslip.accountHolderName],
                  ["Account Number", payslip.accountNumber],
                  ["Bank Name", payslip.bankName],
                  ["IFSC Code", payslip.ifscCode],
                  ["PAN", payslip.panNumber],
                  ["ESIC", payslip.esicNumber],
                  ["UAN", payslip.uan],
                ].map(([label, value]) => (
                  <tr key={label}>
                    <td className="p-2 border w-1/2">{label}</td>
                    <td className="p-2 border">{value || "N/A"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="text-center mt-6">
            <h4 className="text-xl font-bold">
              Net Pay: ₹{payslip.netSalary?.toFixed(2)}
            </h4>
            <p className="text-sm italic text-gray-500">
              {payslip.netSalaryInWords || "Net salary in words"}
            </p>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={downloadPayslipAsPDF}
              className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-6 py-2 rounded shadow"
            >
              Download as PDF
            </button>
          </div>

          <div className="grid grid-cols-2 text-center text-sm mt-10">
            <div>
              <p>Employer Signature</p>
              <hr className="mt-6 border-t border-gray-400 w-3/4 mx-auto" />
            </div>
            <div>
              <p>Employee Signature</p>
              <hr className="mt-6 border-t border-gray-400 w-3/4 mx-auto" />
            </div>
          </div>

          <p className="text-center text-xs mt-4 text-gray-500">
            This is a system generated payslip
          </p>
        </div>
      ) : (
        <p className="text-center text-red-500 font-medium mt-8">
          No payslip found for the selected month.
        </p>
      )}
    </div>
  );
};

export default ViewPayslip;
