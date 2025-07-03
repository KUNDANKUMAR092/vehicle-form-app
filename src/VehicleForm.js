import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import './VehicleForm.css';

const API_URL = 'https://68664e9589803950dbb2214c.mockapi.io/vehicleData';
Modal.setAppElement('#root');

const VehicleForm = () => {
    const [formData, setFormData] = useState({
        id: '', vehicleNo: '', unloadingDate: '', loadingPoint: '', unloadingPoint: '', weight: '',
        companyName: '', companyRate: '', companyNetAmount: '',
        vehicleOwnerName: '', vehicleOwnerRate: '', vehicleOwnerNetAmount: '',
        dieselAmount: '', cashAmount: '', hsdCash: '',
        ownerInstallments: [], companyInstallments: []
    });

    const [vehicleList, setVehicleList] = useState([]);
    const [filteredList, setFilteredList] = useState([]);
    const [filters, setFilters] = useState({});
    const [isEditMode, setIsEditMode] = useState(false);
    const [installmentModal, setInstallmentModal] = useState(false);
    const [ownerHistoryModal, setOwnerHistoryModal] = useState(false);
    const [selectedVehicle, setSelectedVehicle] = useState(null);
    const [selectedOwner, setSelectedOwner] = useState('');
    const [installmentType, setInstallmentType] = useState('');
    const [newInstallment, setNewInstallment] = useState({ date: '', amount: '', mode: '', remarks: '' });

    useEffect(() => { fetchVehicleList(); }, []);

    const fetchVehicleList = async () => {
        const res = await axios.get(API_URL);
        setVehicleList(res.data);
        setFilteredList(res.data);
    };

    const handleFilterChange = (field, value) => {
        const updatedFilters = { ...filters, [field]: value.toLowerCase() };
        setFilters(updatedFilters);

        const filtered = vehicleList.filter(item => {
            return Object.keys(updatedFilters).every(key => {
                if (!updatedFilters[key]) return true;
                return String(item[key] || '').toLowerCase().includes(updatedFilters[key]);
            });
        });

        setFilteredList(filtered);
    };

    const handleChange = (field, value) => {
        const updated = { ...formData, [field]: value };
        const weight = parseFloat(updated.weight || 0);
        const ownerRate = parseFloat(updated.vehicleOwnerRate || 0);
        const companyRate = parseFloat(updated.companyRate || 0);

        updated.vehicleOwnerNetAmount = (weight * ownerRate).toFixed(2);
        updated.companyNetAmount = (weight * companyRate).toFixed(2);
        updated.hsdCash = (
            parseFloat(updated.dieselAmount || 0) +
            parseFloat(updated.cashAmount || 0)
        ).toFixed(2);

        setFormData(updated);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...formData };
        isEditMode
            ? await axios.put(`${API_URL}/${formData.id}`, payload)
            : await axios.post(API_URL, payload);

        resetForm();
        fetchVehicleList();
    };

    const resetForm = () => {
        setFormData({
            id: '',
            vehicleNo: '',
            unloadingDate: '',
            loadingPoint: '',
            unloadingPoint: '',
            weight: '',
            companyName: '',
            companyRate: '',
            companyNetAmount: '',
            vehicleOwnerName: '',
            vehicleOwnerRate: '',
            vehicleOwnerNetAmount: '',
            dieselAmount: '',
            cashAmount: '',
            hsdCash: '',
            ownerInstallments: [],
            companyInstallments: []
        });
        setIsEditMode(false);
    };

    const handleEdit = (row) => {
        setFormData(row);
        setIsEditMode(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        await axios.delete(`${API_URL}/${id}`);
        fetchVehicleList();
    };

    const openInstallmentModal = (vehicle, type) => {
        setSelectedVehicle(vehicle);
        setInstallmentType(type);
        setInstallmentModal(true);
        setNewInstallment({ date: '', amount: '', mode: '', remarks: '' });
    };

    const addInstallment = async () => {
        if (!selectedVehicle || !installmentType) return;

        const updated = {
            ...selectedVehicle,
            [`${installmentType}Installments`]: [
                ...(selectedVehicle[`${installmentType}Installments`] || []),
                newInstallment
            ]
        };

        await axios.put(`${API_URL}/${selectedVehicle.id}`, updated);
        setInstallmentModal(false);
        fetchVehicleList();
    };

    const total = (arr = []) => arr.reduce((sum, i) => sum + Number(i.amount), 0);

    const downloadExcel = (data, filename) => {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const fileData = new Blob([excelBuffer], { type: 'application/octet-stream' });
        saveAs(fileData, filename);
    };

    const exportData = (list, options = { excludeOwner: false, excludeCompany: false }) => {
        const data = list.map(row => {
            const hsd = Number(row.hsdCash || 0);
            const compPaid = total(row.companyInstallments);
            const ownerPaid = total(row.ownerInstallments);
            const result = {
                'Vehicle No.': row.vehicleNo,
                'Unloading Date': row.unloadingDate,
                'Loading Point': row.loadingPoint,
                'Unloading Point': row.unloadingPoint,
                'Weight': row.weight,
                'Diesel Amount': row.dieselAmount,
                'Cash Amount': row.cashAmount,
                'Total HSD Cash': row.hsdCash
            };
            if (!options.excludeCompany) {
                result['Company Name'] = row.companyName;
                result['Company Rate'] = row.companyRate;
                result['Company Net Amount'] = row.companyNetAmount;
                result['Company Paid'] = compPaid;
                result['Company Balance'] = Number(row.companyNetAmount || 0) - compPaid - hsd;
            }
            if (!options.excludeOwner) {
                result['Vehicle Owner Name'] = row.vehicleOwnerName;
                result['Vehicle Owner Rate'] = row.vehicleOwnerRate;
                result['Vehicle Owner Net Amount'] = row.vehicleOwnerNetAmount;
                result['Vehicle Owner Paid'] = ownerPaid;
                result['Vehicle Owner Balance'] = Number(row.vehicleOwnerNetAmount || 0) - ownerPaid - hsd;
            }
            if (!options.excludeOwner && !options.excludeCompany) {
                result['Profit'] = Number(row.companyNetAmount || 0) - Number(row.vehicleOwnerNetAmount || 0);
            }
            return result;
        });
        return data;
    };

    const exportToExcelAll = () => downloadExcel(exportData(filteredList), 'Vehicle_Report_All_Filtered.xlsx');
    const exportWithoutOwnerDetails = () => downloadExcel(exportData(filteredList, { excludeOwner: true }), 'Report_Without_Owner_Filtered.xlsx');
    const exportWithoutCompanyDetails = () => downloadExcel(exportData(filteredList, { excludeCompany: true }), 'Report_Without_Company_Filtered.xlsx');

    const openOwnerHistory = (ownerName) => {
        setSelectedOwner(ownerName);
        setOwnerHistoryModal(true);
    };

    return (
        <div className="vehicle-form-container">
            <h2 className="vehicle-form-title">🚛 Vehicle Work Order Tracker</h2>

            <form onSubmit={handleSubmit} className="vehicle-form">
                <input placeholder="Vehicle No." value={formData.vehicleNo} onChange={e => handleChange('vehicleNo', e.target.value)} required />
                <input type="date" value={formData.unloadingDate} onChange={e => handleChange('unloadingDate', e.target.value)} required />
                <input placeholder="Loading Point" value={formData.loadingPoint} onChange={e => handleChange('loadingPoint', e.target.value)} required />
                <input placeholder="Unloading Point" value={formData.unloadingPoint} onChange={e => handleChange('unloadingPoint', e.target.value)} required />
                <input type="number" placeholder="Weight" value={formData.weight} onChange={e => handleChange('weight', e.target.value)} required />
                <input placeholder="Company Name" value={formData.companyName} onChange={e => handleChange('companyName', e.target.value)} required />
                <input type="number" placeholder="Company Rate" value={formData.companyRate} onChange={e => handleChange('companyRate', e.target.value)} required />
                <input placeholder="Company Net Amount" value={formData.companyNetAmount} readOnly />
                <input placeholder="Vehicle Owner Name" value={formData.vehicleOwnerName} onChange={e => handleChange('vehicleOwnerName', e.target.value)} required />
                <input type="number" placeholder="Vehicle Owner Rate" value={formData.vehicleOwnerRate} onChange={e => handleChange('vehicleOwnerRate', e.target.value)} required />
                <input placeholder="Vehicle Owner Net Amount" value={formData.vehicleOwnerNetAmount} readOnly />
                <input type="number" placeholder="Diesel Amount" value={formData.dieselAmount} onChange={e => handleChange('dieselAmount', e.target.value)} />
                <input type="number" placeholder="Cash Amount" value={formData.cashAmount} onChange={e => handleChange('cashAmount', e.target.value)} />
                <input placeholder="Total HSD Cash" value={formData.hsdCash} readOnly />
                <button type="submit" className="btn btn-submit">{isEditMode ? '✏️ Update' : '➕ Submit'}</button>
            </form>

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                <button onClick={exportToExcelAll} className="btn btn-export">📤 Export Filtered (All)</button>
                <button onClick={exportWithoutOwnerDetails} className="btn btn-export">🚫 Export Filtered w/o Owner & Profit</button>
                <button onClick={exportWithoutCompanyDetails} className="btn btn-export">🚫 Export Filtered w/o Company & Profit</button>
            </div>

            <div className="vehicle-table-scroll">
                <table className="vehicle-table">
                    <thead>
                        <tr>
                            <th>Vehicle No.<br /><input onChange={(e) => handleFilterChange('vehicleNo', e.target.value)} /></th>
                            <th>Date<br /><input onChange={(e) => handleFilterChange('unloadingDate', e.target.value)} /></th>
                            <th>Loading<br /><input onChange={(e) => handleFilterChange('loadingPoint', e.target.value)} /></th>
                            <th>Unloading<br /><input onChange={(e) => handleFilterChange('unloadingPoint', e.target.value)} /></th>
                            <th>Weight<br /><input onChange={(e) => handleFilterChange('weight', e.target.value)} /></th>
                            <th>Diesel<br /><input onChange={(e) => handleFilterChange('dieselAmount', e.target.value)} /></th>
                            <th>Cash<br /><input onChange={(e) => handleFilterChange('cashAmount', e.target.value)} /></th>
                            <th>HSD<br /><input onChange={(e) => handleFilterChange('hsdCash', e.target.value)} /></th>
                            <th>Company Name<br /><input onChange={(e) => handleFilterChange('companyName', e.target.value)} /></th>
                            <th>Company Rate<br /><input onChange={(e) => handleFilterChange('companyRate', e.target.value)} /></th>
                            <th>Company Net<br /><input onChange={(e) => handleFilterChange('companyNetAmount', e.target.value)} /></th>
                            <th>Company Paid</th>
                            <th>Company Net Balance</th>
                            <th>Vehicle Owner Name<br /><input onChange={(e) => handleFilterChange('vehicleOwnerName', e.target.value)} /></th>
                            <th>Vehicle Owner Rate<br /><input onChange={(e) => handleFilterChange('vehicleOwnerRate', e.target.value)} /></th>
                            <th>Vehicle Owner Net<br /><input onChange={(e) => handleFilterChange('vehicleOwnerNetAmount', e.target.value)} /></th>
                            <th>Vehicle Owner Paid</th>
                            <th>Vehicle Owner Net Balance</th>
                            <th>Profit</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.map((v, i) => {
                            const ownerPaid = total(v.ownerInstallments);
                            const compPaid = total(v.companyInstallments);
                            const hsd = Number(v.hsdCash || 0);
                            const ownerBal = Number(v.vehicleOwnerNetAmount || 0) - ownerPaid - hsd;
                            const compBal = Number(v.companyNetAmount || 0) - compPaid - hsd;
                            const profit = Number(v.companyNetAmount || 0) - Number(v.vehicleOwnerNetAmount || 0);

                            return (
                                <tr key={v.id} className={i % 2 === 0 ? 'even-row' : ''}>
                                    <td>{v.vehicleNo}</td>
                                    <td>{v.unloadingDate}</td>
                                    <td>{v.loadingPoint}</td>
                                    <td>{v.unloadingPoint}</td>
                                    <td>{v.weight}</td>
                                    <td>{v.dieselAmount}</td>
                                    <td>{v.cashAmount}</td>
                                    <td>{v.hsdCash}</td>
                                    <td>{v.companyName}</td>
                                    <td>{v.companyRate}</td>
                                    <td>{v.companyNetAmount}</td>
                                    <td>₹ {compPaid.toFixed(2)}</td>
                                    <td>₹ {compBal.toFixed(2)}</td>
                                    <td>{v.vehicleOwnerName}</td>
                                    <td>{v.vehicleOwnerRate}</td>
                                    <td>{v.vehicleOwnerNetAmount}</td>
                                    <td>₹ {ownerPaid.toFixed(2)}</td>
                                    <td>₹ {ownerBal.toFixed(2)}</td>
                                    <td>₹ {profit.toFixed(2)}</td>
                                    <td>
                                        <button onClick={() => handleEdit(v)} className="btn btn-edit">✏️</button>
                                        <button onClick={() => handleDelete(v.id)} className="btn btn-delete">🗑️</button>
                                        <button onClick={() => openInstallmentModal(v, 'owner')} className="btn btn-installment">💰 Owner</button>
                                        <button onClick={() => openInstallmentModal(v, 'company')} className="btn btn-installment">🏢 Company</button>
                                        <button onClick={() => openOwnerHistory(v.vehicleOwnerName)} className="btn btn-history">📊 History</button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Installment Modal */}
            <Modal isOpen={installmentModal} onRequestClose={() => setInstallmentModal(false)} className="custom-modal" overlayClassName="custom-overlay">
                <h3>{installmentType === 'owner' ? 'Vehicle Owner' : 'Company'} Installments for: {selectedVehicle?.vehicleNo}</h3>
                <table className="installment-table">
                    <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Remarks</th></tr></thead>
                    <tbody>
                        {selectedVehicle?.[`${installmentType}Installments`]?.map((inst, i) => (
                            <tr key={i}><td>{inst.date}</td><td>₹ {inst.amount}</td><td>{inst.mode}</td><td>{inst.remarks}</td></tr>
                        ))}
                    </tbody>
                </table>
                <h4>Add Installment</h4>
                <input type="date" value={newInstallment.date} onChange={e => setNewInstallment({ ...newInstallment, date: e.target.value })} />
                <input type="number" value={newInstallment.amount} onChange={e => setNewInstallment({ ...newInstallment, amount: e.target.value })} />
                <input placeholder="Mode" value={newInstallment.mode} onChange={e => setNewInstallment({ ...newInstallment, mode: e.target.value })} />
                <input placeholder="Remarks" value={newInstallment.remarks} onChange={e => setNewInstallment({ ...newInstallment, remarks: e.target.value })} />
                <br />
                <button onClick={addInstallment} className="btn btn-installment btn-add-installment">➕ Add Installment</button>
            </Modal>

            {/* Owner History Modal */}
            <Modal isOpen={ownerHistoryModal} onRequestClose={() => setOwnerHistoryModal(false)} className="custom-modal" overlayClassName="custom-overlay">
                <h3>History for Owner: {selectedOwner}</h3>
                <table className="installment-table">
                    <thead><tr><th>Vehicle</th><th>Date</th><th>Net Amount</th><th>Paid</th><th>Balance</th></tr></thead>
                    <tbody>
                        {vehicleList.filter(v => v.vehicleOwnerName === selectedOwner).map((v, i) => {
                            const paid = total(v.ownerInstallments);
                            const balance = Number(v.vehicleOwnerNetAmount || 0) - paid - Number(v.hsdCash || 0);
                            return (
                                <tr key={i}>
                                    <td>{v.vehicleNo}</td>
                                    <td>{v.unloadingDate}</td>
                                    <td>₹ {v.vehicleOwnerNetAmount}</td>
                                    <td>₹ {paid}</td>
                                    <td>₹ {balance}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </Modal>
        </div>
    );
};

export default VehicleForm;









































// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import Modal from 'react-modal';
// import * as XLSX from 'xlsx';
// import { saveAs } from 'file-saver';
// import './VehicleForm.css';

// const API_URL = 'https://68664e9589803950dbb2214c.mockapi.io/vehicleData';
// Modal.setAppElement('#root');

// const VehicleForm = () => {
//   const [formData, setFormData] = useState({
//     id: '',
//     vehicleNo: '',
//     unloadingDate: '',
//     loadingPoint: '',
//     unloadingPoint: '',
//     weight: '',
//     companyName: '',
//     companyRate: '',
//     companyNetAmount: '',
//     vehicleOwnerName: '',
//     vehicleOwnerRate: '',
//     vehicleOwnerNetAmount: '',
//     dieselAmount: '',
//     cashAmount: '',
//     hsdCash: '',
//     ownerInstallments: [],
//     companyInstallments: []
//   });

//   const [vehicleList, setVehicleList] = useState([]);
//   const [isEditMode, setIsEditMode] = useState(false);
//   const [installmentModal, setInstallmentModal] = useState(false);
//   const [ownerHistoryModal, setOwnerHistoryModal] = useState(false);
//   const [selectedVehicle, setSelectedVehicle] = useState(null);
//   const [selectedOwner, setSelectedOwner] = useState('');
//   const [installmentType, setInstallmentType] = useState('');
//   const [newInstallment, setNewInstallment] = useState({ date: '', amount: '', mode: '', remarks: '' });

//   useEffect(() => {
//     fetchVehicleList();
//   }, []);

//   const fetchVehicleList = async () => {
//     const res = await axios.get(API_URL);
//     setVehicleList(res.data);
//   };

//   const handleChange = (field, value) => {
//     const updated = { ...formData, [field]: value };
//     const weight = parseFloat(updated.weight || 0);
//     const ownerRate = parseFloat(updated.vehicleOwnerRate || 0);
//     const companyRate = parseFloat(updated.companyRate || 0);

//     updated.vehicleOwnerNetAmount = (weight * ownerRate).toFixed(2);
//     updated.companyNetAmount = (weight * companyRate).toFixed(2);
//     updated.hsdCash = (
//       parseFloat(updated.dieselAmount || 0) +
//       parseFloat(updated.cashAmount || 0)
//     ).toFixed(2);

//     setFormData(updated);
//   };

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     const payload = { ...formData };
//     isEditMode
//       ? await axios.put(`${API_URL}/${formData.id}`, payload)
//       : await axios.post(API_URL, payload);

//     resetForm();
//     fetchVehicleList();
//   };

//   const resetForm = () => {
//     setFormData({
//       id: '',
//       vehicleNo: '',
//       unloadingDate: '',
//       loadingPoint: '',
//       unloadingPoint: '',
//       weight: '',
//       companyName: '',
//       companyRate: '',
//       companyNetAmount: '',
//       vehicleOwnerName: '',
//       vehicleOwnerRate: '',
//       vehicleOwnerNetAmount: '',
//       dieselAmount: '',
//       cashAmount: '',
//       hsdCash: '',
//       ownerInstallments: [],
//       companyInstallments: []
//     });
//     setIsEditMode(false);
//   };

//   const handleEdit = (row) => {
//     setFormData(row);
//     setIsEditMode(true);
//     window.scrollTo({ top: 0, behavior: 'smooth' });
//   };

//   const handleDelete = async (id) => {
//     await axios.delete(`${API_URL}/${id}`);
//     fetchVehicleList();
//   };

//   const openInstallmentModal = (vehicle, type) => {
//     setSelectedVehicle(vehicle);
//     setInstallmentType(type);
//     setInstallmentModal(true);
//     setNewInstallment({ date: '', amount: '', mode: '', remarks: '' });
//   };

//   const addInstallment = async () => {
//     if (!selectedVehicle || !installmentType) return;

//     const updated = {
//       ...selectedVehicle,
//       [`${installmentType}Installments`]: [
//         ...(selectedVehicle[`${installmentType}Installments`] || []),
//         newInstallment
//       ]
//     };

//     await axios.put(`${API_URL}/${selectedVehicle.id}`, updated);
//     setInstallmentModal(false);
//     fetchVehicleList();
//   };

//   const exportToExcel = () => {
//     const exportData = vehicleList.map(row => ({
//       'Vehicle No.': row.vehicleNo,
//       'Unloading Date': row.unloadingDate,
//       'Loading Point': row.loadingPoint,
//       'Unloading Point': row.unloadingPoint,
//       'Weight': row.weight,
//       'Company Name': row.companyName,
//       'Company Rate': row.companyRate,
//       'Company Net Amount': row.companyNetAmount,
//       'Company Paid': total(row.companyInstallments),
//       'Company Balance': Number(row.companyNetAmount || 0) - total(row.companyInstallments),
//       'Vehicle Owner Name': row.vehicleOwnerName,
//       'Vehicle Owner Rate': row.vehicleOwnerRate,
//       'Vehicle Owner Net Amount': row.vehicleOwnerNetAmount,
//       'Vehicle Owner Paid': total(row.ownerInstallments),
//       'Vehicle Owner Balance': Number(row.vehicleOwnerNetAmount || 0) - total(row.ownerInstallments),
//       'Diesel Amount': row.dieselAmount,
//       'Cash Amount': row.cashAmount,
//       'Total HSD Cash': row.hsdCash
//     }));

//     const worksheet = XLSX.utils.json_to_sheet(exportData);
//     const workbook = XLSX.utils.book_new();
//     XLSX.utils.book_append_sheet(workbook, worksheet, 'Vehicle Report');
//     const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
//     const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
//     saveAs(data, 'Vehicle_Report.xlsx');
//   };

//   const total = (arr = []) => arr.reduce((sum, i) => sum + Number(i.amount), 0);

//   const openOwnerHistory = (ownerName) => {
//     setSelectedOwner(ownerName);
//     setOwnerHistoryModal(true);
//   };

//   return (
//     <div className="vehicle-form-container">
//       <h2 className="vehicle-form-title">🚛 Vehicle Work Order Tracker</h2>

//       <form onSubmit={handleSubmit} className="vehicle-form">
//         <input placeholder="Vehicle No." value={formData.vehicleNo} onChange={e => handleChange('vehicleNo', e.target.value)} required />
//         <input type="date" value={formData.unloadingDate} onChange={e => handleChange('unloadingDate', e.target.value)} required />
//         <input placeholder="Loading Point" value={formData.loadingPoint} onChange={e => handleChange('loadingPoint', e.target.value)} required />
//         <input placeholder="Unloading Point" value={formData.unloadingPoint} onChange={e => handleChange('unloadingPoint', e.target.value)} required />
//         <input type="number" placeholder="Weight" value={formData.weight} onChange={e => handleChange('weight', e.target.value)} required />
//         <input placeholder="Company Name" value={formData.companyName} onChange={e => handleChange('companyName', e.target.value)} required />
//         <input type="number" placeholder="Company Rate" value={formData.companyRate} onChange={e => handleChange('companyRate', e.target.value)} required />
//         <input placeholder="Company Net Amount" value={formData.companyNetAmount} readOnly />
//         <input placeholder="Vehicle Owner Name" value={formData.vehicleOwnerName} onChange={e => handleChange('vehicleOwnerName', e.target.value)} required />
//         <input type="number" placeholder="Vehicle Owner Rate" value={formData.vehicleOwnerRate} onChange={e => handleChange('vehicleOwnerRate', e.target.value)} required />
//         <input placeholder="Vehicle Owner Net Amount" value={formData.vehicleOwnerNetAmount} readOnly />
//         <input type="number" placeholder="Diesel Amount" value={formData.dieselAmount} onChange={e => handleChange('dieselAmount', e.target.value)} />
//         <input type="number" placeholder="Cash Amount" value={formData.cashAmount} onChange={e => handleChange('cashAmount', e.target.value)} />
//         <input placeholder="Total HSD Cash" value={formData.hsdCash} readOnly />
//         <button type="submit" className="btn btn-submit">{isEditMode ? '✏️ Update' : '➕ Submit'}</button>
//       </form>

//       <button onClick={exportToExcel} className="btn btn-export">📤 Export to Excel</button>

//       <table className="vehicle-table">
//         <thead>
//           <tr>
//             <th>Vehicle No.</th>
//             <th>Date</th>
//             <th>Loading</th>
//             <th>Unloading</th>
//             <th>Weight</th>
//             <th>Diesel</th>
//             <th>Cash</th>
//             <th>HSD</th>
//             <th>Company Name</th>
//             <th>Company Rate</th>
//             <th>Company Net</th>
//             <th>Company Paid</th>
//             <th>Company Net Balance</th>
//             <th>Vehicle Owner Name</th>
//             <th>Vehicle Owner Rate</th>
//             <th>Vehicle Owner Net</th>
//             <th>Vehicle Owner Paid</th>
//             <th>Vehicle Owner Net Balance</th>
//             <th>Actions</th>
//           </tr>
//         </thead>
//         <tbody>
//           {vehicleList.map((v, i) => {
//             const ownerPaid = total(v.ownerInstallments);
//             const ownerBal = Number(v.vehicleOwnerNetAmount || 0) - ownerPaid;
//             const compPaid = total(v.companyInstallments);
//             const compBal = Number(v.companyNetAmount || 0) - compPaid;

//             return (
//               <tr key={v.id} className={i % 2 === 0 ? 'even-row' : ''}>
//                 <td>{v.vehicleNo}</td>
//                 <td>{v.unloadingDate}</td>
//                 <td>{v.loadingPoint}</td>
//                 <td>{v.unloadingPoint}</td>
//                 <td>{v.weight}</td>
//                 <td>{v.dieselAmount}</td>
//                 <td>{v.cashAmount}</td>
//                 <td>{v.hsdCash}</td>
//                 <td>{v.companyName}</td>
//                 <td>{v.companyRate}</td>
//                 <td>{v.companyNetAmount}</td>
//                 <td>₹ {compPaid.toFixed(2)}</td>
//                 <td>₹ {compBal.toFixed(2)}</td>
//                 <td>{v.vehicleOwnerName}</td>
//                 <td>{v.vehicleOwnerRate}</td>
//                 <td>{v.vehicleOwnerNetAmount}</td>
//                 <td>₹ {ownerPaid.toFixed(2)}</td>
//                 <td>₹ {ownerBal.toFixed(2)}</td>
//                 <td>
//                   <button onClick={() => handleEdit(v)} className="btn btn-edit">✏️</button>
//                   <button onClick={() => handleDelete(v.id)} className="btn btn-delete">🗑️</button>
//                   <button onClick={() => openInstallmentModal(v, 'owner')} className="btn btn-installment">💰 Owner</button>
//                   <button onClick={() => openInstallmentModal(v, 'company')} className="btn btn-installment">🏢 Company</button>
//                   <button onClick={() => openOwnerHistory(v.vehicleOwnerName)} className="btn btn-history">📊 History</button>
//                 </td>
//               </tr>
//             );
//           })}
//         </tbody>
//       </table>

//       {/* Installment Modal */}
//       <Modal
//         isOpen={installmentModal}
//         onRequestClose={() => setInstallmentModal(false)}
//         className="custom-modal"
//         overlayClassName="custom-overlay"
//         contentLabel="Installment Modal"
//       >
//         <h3>{installmentType === 'owner' ? 'Vehicle Owner' : 'Company'} Installments for: {selectedVehicle?.vehicleNo}</h3>
//         <table className="installment-table">
//           <thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Remarks</th></tr></thead>
//           <tbody>
//             {selectedVehicle?.[`${installmentType}Installments`]?.map((inst, i) => (
//               <tr key={i}><td>{inst.date}</td><td>₹ {inst.amount}</td><td>{inst.mode}</td><td>{inst.remarks}</td></tr>
//             ))}
//           </tbody>
//         </table>
//         <h4>Add Installment</h4>
//         <input type="date" value={newInstallment.date} onChange={e => setNewInstallment({ ...newInstallment, date: e.target.value })} />
//         <input type="number" value={newInstallment.amount} onChange={e => setNewInstallment({ ...newInstallment, amount: e.target.value })} />
//         <input placeholder="Mode" value={newInstallment.mode} onChange={e => setNewInstallment({ ...newInstallment, mode: e.target.value })} />
//         <input placeholder="Remarks" value={newInstallment.remarks} onChange={e => setNewInstallment({ ...newInstallment, remarks: e.target.value })} />
//         <br />
//         <button onClick={addInstallment} className="btn btn-installment btn-add-installment">➕ Add Installment</button>
//       </Modal>

//       {/* Owner History Modal */}
//       <Modal
//         isOpen={ownerHistoryModal}
//         onRequestClose={() => setOwnerHistoryModal(false)}
//         className="custom-modal"
//         overlayClassName="custom-overlay"
//         contentLabel="Owner History"
//       >
//         <h3>History for Owner: {selectedOwner}</h3>
//         <table className="installment-table">
//           <thead><tr><th>Vehicle</th><th>Date</th><th>Net Amount</th><th>Paid</th><th>Balance</th></tr></thead>
//           <tbody>
//             {vehicleList.filter(v => v.vehicleOwnerName === selectedOwner).map((v, i) => {
//               const paid = total(v.ownerInstallments);
//               const balance = Number(v.vehicleOwnerNetAmount || 0) - paid;
//               return (
//                 <tr key={i}>
//                   <td>{v.vehicleNo}</td>
//                   <td>{v.unloadingDate}</td>
//                   <td>₹ {v.vehicleOwnerNetAmount}</td>
//                   <td>₹ {paid}</td>
//                   <td>₹ {balance}</td>
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//       </Modal>
//     </div>
//   );
// };

// export default VehicleForm;











// import React, { useState, useEffect } from 'react';
// import axios from 'axios';
// import Modal from 'react-modal';
// import * as XLSX from 'xlsx';
// import { saveAs } from 'file-saver';
// import './VehicleForm.css';

// const API_URL = 'https://68664e9589803950dbb2214c.mockapi.io/vehicleData';
// Modal.setAppElement('#root');

// const VehicleForm = () => {
//     const [formData, setFormData] = useState({
//         id: '', vehicleNo: '', unloadingDate: '', loadingPoint: '',
//         unloadingPoint: '', weight: '', rate: '', netAmount: '',
//         hsdCash: '', installments: []
//     });

//     const [vehicleList, setVehicleList] = useState([]);
//     const [isEditMode, setIsEditMode] = useState(false);
//     const [installmentModal, setInstallmentModal] = useState(false);
//     const [selectedVehicle, setSelectedVehicle] = useState(null);
//     const [newInstallment, setNewInstallment] = useState({ date: '', amount: '', mode: '', remarks: '' });

//     useEffect(() => {
//         fetchVehicleList();
//     }, []);

//     const fetchVehicleList = async () => {
//         const res = await axios.get(API_URL);
//         setVehicleList(res.data);
//     };

//     const handleChange = (field, value) => {
//         const updated = { ...formData, [field]: value };
//         if (field === 'weight' || field === 'rate') {
//             const weight = parseFloat(field === 'weight' ? value : updated.weight || 0);
//             const rate = parseFloat(field === 'rate' ? value : updated.rate || 0);
//             updated.netAmount = (weight * rate).toFixed(2);
//         }
//         setFormData(updated);
//     };

//     const handleSubmit = async (e) => {
//         e.preventDefault();
//         const payload = { ...formData, installments: formData.installments || [] };
//         isEditMode
//             ? await axios.put(`${API_URL}/${formData.id}`, payload)
//             : await axios.post(API_URL, payload);

//         setFormData({
//             id: '', vehicleNo: '', unloadingDate: '', loadingPoint: '',
//             unloadingPoint: '', weight: '', rate: '', netAmount: '',
//             hsdCash: '', installments: []
//         });

//         setIsEditMode(false);
//         fetchVehicleList();
//     };

//     const handleEdit = (row) => {
//         setFormData(row);
//         setIsEditMode(true);
//         window.scrollTo({ top: 0, behavior: 'smooth' });
//     };

//     const handleDelete = async (id) => {
//         await axios.delete(`${API_URL}/${id}`);
//         fetchVehicleList();
//     };

//     const openInstallmentModal = (vehicle) => {
//         setSelectedVehicle(vehicle);
//         setInstallmentModal(true);
//         setNewInstallment({ date: '', amount: '', mode: '', remarks: '' });
//     };

//     const addInstallment = async () => {
//         if (!selectedVehicle) return;
//         const updated = {
//             ...selectedVehicle,
//             installments: [...(selectedVehicle.installments || []), newInstallment]
//         };
//         await axios.put(`${API_URL}/${selectedVehicle.id}`, updated);
//         setInstallmentModal(false);
//         fetchVehicleList();
//     };

//     const exportToExcel = () => {
//         const exportData = vehicleList.map(row => ({
//             'Vehicle No.': row.vehicleNo,
//             'Unloading Date': row.unloadingDate,
//             'Loading Point': row.loadingPoint,
//             'Unloading Point': row.unloadingPoint,
//             'Weight': row.weight,
//             'Rate': row.rate,
//             'Net Amount': row.netAmount,
//             'HSD CASH': row.hsdCash
//         }));

//         const worksheet = XLSX.utils.json_to_sheet(exportData);
//         const workbook = XLSX.utils.book_new();
//         XLSX.utils.book_append_sheet(workbook, worksheet, 'Vehicle Report');
//         const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
//         const data = new Blob([excelBuffer], { type: 'application/octet-stream' });
//         saveAs(data, 'Vehicle_Report.xlsx');
//     };

//     return (
//         <div className="vehicle-form-container">
//             <h2 className="vehicle-form-title">🚚 Vehicle Entry Form</h2>

//             <form onSubmit={handleSubmit} className="vehicle-form">
//                 <input placeholder="Vehicle No." value={formData.vehicleNo} onChange={e => handleChange('vehicleNo', e.target.value)} required />
//                 <input type="date" value={formData.unloadingDate} onChange={e => handleChange('unloadingDate', e.target.value)} required />
//                 <input placeholder="Loading Point" value={formData.loadingPoint} onChange={e => handleChange('loadingPoint', e.target.value)} required />
//                 <input placeholder="Unloading Point" value={formData.unloadingPoint} onChange={e => handleChange('unloadingPoint', e.target.value)} required />
//                 <input type="number" placeholder="Weight" value={formData.weight} onChange={e => handleChange('weight', e.target.value)} required />
//                 <input type="number" placeholder="Rate" value={formData.rate} onChange={e => handleChange('rate', e.target.value)} required />
//                 <input placeholder="Net Amount" value={formData.netAmount} readOnly />
//                 <input placeholder="HSD CASH" value={formData.hsdCash} onChange={e => handleChange('hsdCash', e.target.value)} />
//                 <button type="submit" className="btn btn-submit">
//                     {isEditMode ? '✏️ Update' : '➕ Submit'}
//                 </button>
//             </form>

//             <button onClick={exportToExcel} className="btn btn-export">📤 Export to Excel</button>

//             <table className="vehicle-table">
//                 <thead>
//                     <tr>
//                         <th>Vehicle No.</th>
//                         <th>Date</th>
//                         <th>Loading</th>
//                         <th>Unloading</th>
//                         <th>Weight</th>
//                         <th>Rate</th>
//                         <th>Net</th>
//                         <th>HSD</th>
//                         <th>Paid</th>
//                         <th>Balance</th>
//                         <th>Actions</th>
//                     </tr>
//                 </thead>
//                 <tbody>
//                     {vehicleList.map((v, i) => {
//                         const paid = v.installments?.reduce((sum, inst) => sum + Number(inst.amount), 0) || 0;
//                         const balance = Number(v.netAmount || 0) - paid;
//                         return (
//                             <tr key={v.id} className={i % 2 === 0 ? 'even-row' : ''}>
//                                 <td>{v.vehicleNo}</td>
//                                 <td>{v.unloadingDate}</td>
//                                 <td>{v.loadingPoint}</td>
//                                 <td>{v.unloadingPoint}</td>
//                                 <td>{v.weight}</td>
//                                 <td>{v.rate}</td>
//                                 <td>{v.netAmount}</td>
//                                 <td>{v.hsdCash}</td>
//                                 <td>₹ {paid.toFixed(2)}</td>
//                                 <td>₹ {balance.toFixed(2)}</td>
//                                 <td>
//                                     <button onClick={() => handleEdit(v)} className="btn btn-edit">✏️</button>
//                                     <button onClick={() => handleDelete(v.id)} className="btn btn-delete">🗑️</button>
//                                     <button onClick={() => openInstallmentModal(v)} className="btn btn-installment">💰</button>
//                                 </td>
//                             </tr>
//                         );
//                     })}
//                 </tbody>
//             </table>

//             <Modal
//                 isOpen={installmentModal}
//                 onRequestClose={() => setInstallmentModal(false)}
//                 className="custom-modal"
//                 overlayClassName="custom-overlay"
//                 contentLabel="Installment Modal"
//             >

//                 <h3>Installments for: {selectedVehicle?.vehicleNo}</h3>
//                 <table className="installment-table">
//                     <thead>
//                         <tr><th>Date</th><th>Amount</th><th>Mode</th><th>Remarks</th></tr>
//                     </thead>
//                     <tbody>
//                         {selectedVehicle?.installments?.map((inst, i) => (
//                             <tr key={i}>
//                                 <td>{inst.date}</td>
//                                 <td>₹ {inst.amount}</td>
//                                 <td>{inst.mode}</td>
//                                 <td>{inst.remarks}</td>
//                             </tr>
//                         ))}
//                     </tbody>
//                 </table>

//                 <h4>Add New Installment</h4>
//                 <input type="date" value={newInstallment.date} onChange={e => setNewInstallment({ ...newInstallment, date: e.target.value })} />
//                 <input type="number" value={newInstallment.amount} onChange={e => setNewInstallment({ ...newInstallment, amount: e.target.value })} />
//                 <input placeholder="Mode" value={newInstallment.mode} onChange={e => setNewInstallment({ ...newInstallment, mode: e.target.value })} />
//                 <input placeholder="Remarks" value={newInstallment.remarks} onChange={e => setNewInstallment({ ...newInstallment, remarks: e.target.value })} />
//                 <br />
//                 <button onClick={addInstallment} className="btn btn-installment btn-add-installment">➕ Add Installment</button>
//             </Modal>
//         </div>
//     );
// };

// export default VehicleForm;
