import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dataStore } from '../lib/dataStore';
import Modal from '../components/Modal';

export default function AssignmentsView() {
  const { currentUser, isManager, triggerRefresh } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState('staff'); // 'staff' | 'fleet' | 'corridors' | 'food'

  // Modals state
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isFoodModalOpen, setIsFoodModalOpen] = useState(false);
  const [staffPendingDelete, setStaffPendingDelete] = useState(null);
  const [vehiclePendingDelete, setVehiclePendingDelete] = useState(null);

  // Selected entities for modals
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Form states
  const [staffForm, setStaffForm] = useState({
    full_name: '',
    email: '',
    phone: '',
    initial_password: '',
    daily_food_allowance: 500,
    daily_travel_allowance: 250,
  });

  const [vehicleForm, setVehicleForm] = useState({
    plate_number: '',
    model: '',
    vehicle_type: 'tanker',
    capacity_liters: '',
    assigned_driver_id: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    new_password: '',
    confirm_password: '',
  });

  const [foodForm, setFoodForm] = useState({
    daily_food_allowance: 500,
    daily_travel_allowance: 250,
  });

  // Restrict access if not a manager
  if (!isManager) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-surface-container-lowest border border-outline-variant/30 rounded min-h-[460px]">
        <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mb-4">
          <span className="material-symbols-outlined text-[32px]">shield_lock</span>
        </div>
        <h2 className="font-headline-lg text-2xl font-bold text-primary">Manager Access Only</h2>
        <p className="font-body-md text-[14px] text-secondary max-w-md mt-2">
          Fleet configuration, carrier driver management, credential resets, and allowance governance are restricted to Operations Managers.
        </p>
        <div className="mt-5 p-3 rounded bg-surface-container-low border border-outline-variant/30 text-[12px] font-label-code text-on-surface-variant max-w-sm">
          Active Role: <span className="font-bold uppercase text-primary">{currentUser?.role || 'Staff'}</span> · Authorized to log dispatches, vehicle fuel, and station invoices.
        </div>
      </div>
    );
  }

  const staffProfiles = dataStore.profiles.filter((p) => p.role === 'staff');
  const activeStaffProfiles = staffProfiles.filter((p) => p.is_active !== false);
  const allRoutes = dataStore.routes;
  const allStations = dataStore.stations;
  const allVehicles = dataStore.vehicles || [];
  const foodAllowances = dataStore.foodAllowances || [];

  // Handlers
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    if (!staffForm.full_name || !staffForm.email) {
      toastError('Full name and email are mandatory.');
      return;
    }
    if (!staffForm.initial_password || staffForm.initial_password.length < 8) {
      toastError('An initial password of at least 8 characters is required.');
      return;
    }

    try {
      const newStaff = await dataStore.createStaff(
        {
          full_name: staffForm.full_name,
          email: staffForm.email,
          phone: staffForm.phone,
          initial_password: staffForm.initial_password,
        },
        currentUser
      );

      // Save food allowance
      await dataStore.setStaffFoodAllowance(
        newStaff.id,
        staffForm.daily_food_allowance,
        staffForm.daily_travel_allowance,
        currentUser
      );

      setIsStaffModalOpen(false);
      setStaffForm({
        full_name: '',
        email: '',
        phone: '',
        initial_password: '',
        daily_food_allowance: 500,
        daily_travel_allowance: 250,
      });
      triggerRefresh();
      toastSuccess(`Staff member "${newStaff.full_name}" registered successfully.`);
    } catch (err) {
      toastError('Error registering staff: ' + err.message);
    }
  };

  const handleCreateVehicle = async (e) => {
    e.preventDefault();
    if (!vehicleForm.plate_number) {
      toastError('Vehicle registration plate number is required.');
      return;
    }

    try {
      const newVeh = await dataStore.createVehicle(vehicleForm, currentUser);
      setIsVehicleModalOpen(false);
      setVehicleForm({
        plate_number: '',
        model: 'BharatBenz 2823R Rigid Tanker',
        vehicle_type: 'tanker',
        capacity_liters: 16000,
        assigned_driver_id: '',
      });
      triggerRefresh();
      toastSuccess(`Vehicle "${newVeh.plate_number}" registered to fleet.`);
    } catch (err) {
      toastError('Error adding vehicle: ' + err.message);
    }
  };

  const handleAssignVehicle = async (vehicleId, driverId) => {
    try {
      await dataStore.assignVehicle(vehicleId, driverId, currentUser);
      triggerRefresh();
      toastSuccess('Vehicle assignment updated.');
    } catch (err) {
      toastError('Error assigning vehicle: ' + err.message);
    }
  };

  const openResetPasswordModal = (staff) => {
    setSelectedStaff(staff);
    setPasswordForm({ new_password: '', confirm_password: '' });
    setIsPasswordModalOpen(true);
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!passwordForm.new_password) {
      toastError('Please enter a new password.');
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toastError('Passwords do not match.');
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toastError('Password must be at least 8 characters long.');
      return;
    }

    try {
      await dataStore.resetStaffPassword(selectedStaff.id, passwordForm.new_password, currentUser);
      setIsPasswordModalOpen(false);
      triggerRefresh();
      toastSuccess(`Password reset successfully for ${selectedStaff.full_name}.`);
    } catch (err) {
      toastError('Failed to reset password: ' + err.message);
    }
  };

  const generateRandomPassword = () => {
    // Cryptographically strong: Math.random() is not suitable for credentials.
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    const bytes = new Uint32Array(16);
    crypto.getRandomValues(bytes);
    let res = 'Petro@';
    for (let i = 0; i < 12; i++) {
      res += alphabet.charAt(bytes[i] % alphabet.length);
    }
    setPasswordForm({ new_password: res, confirm_password: res });
  };

  const openFoodModal = (staff) => {
    setSelectedStaff(staff);
    const existing = foodAllowances.find((f) => f.staff_id === staff.id);
    setFoodForm({
      daily_food_allowance: existing ? existing.daily_food_allowance : 500,
      daily_travel_allowance: existing ? existing.daily_travel_allowance : 250,
    });
    setIsFoodModalOpen(true);
  };

  const handleSaveFoodAllowance = async (e) => {
    e.preventDefault();
    try {
      await dataStore.setStaffFoodAllowance(
        selectedStaff.id,
        foodForm.daily_food_allowance,
        foodForm.daily_travel_allowance,
        currentUser
      );
      setIsFoodModalOpen(false);
      triggerRefresh();
      toastSuccess(`Daily allowance updated for ${selectedStaff.full_name}.`);
    } catch (err) {
      toastError('Failed to update food allowance: ' + err.message);
    }
  };

  const handleToggleRoute = async (staffId, routeId) => {
    try {
      await dataStore.toggleStaffRouteAssignment(staffId, routeId, currentUser);
      triggerRefresh();
    } catch (err) {
      toastError('Failed to toggle corridor: ' + err.message);
    }
  };

  const handleToggleStation = async (staffId, stationId) => {
    try {
      await dataStore.toggleStaffStationAssignment(staffId, stationId, currentUser);
      triggerRefresh();
    } catch (err) {
      toastError('Failed to toggle station: ' + err.message);
    }
  };

  const handleConfirmDeleteStaff = async () => {
    if (!staffPendingDelete) return;
    const target = staffPendingDelete;
    try {
      await dataStore.deleteStaff(target.id, currentUser);
      setStaffPendingDelete(null);
      triggerRefresh();
      toastSuccess(`"${target.full_name}" removed from the carrier directory.`);
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleToggleStaffActive = async (staff) => {
    const nextActive = staff.is_active === false;
    try {
      await dataStore.setStaffActive(staff.id, nextActive, currentUser);
      triggerRefresh();
      toastSuccess(
        nextActive
          ? `"${staff.full_name}" reactivated. Login access restored.`
          : `"${staff.full_name}" deactivated. Login access revoked and credentials cleared.`
      );
    } catch (err) {
      toastError(err.message);
    }
  };

  const handleConfirmDeleteVehicle = async () => {
    if (!vehiclePendingDelete) return;
    const target = vehiclePendingDelete;
    try {
      await dataStore.deleteVehicle(target.id, currentUser);
      setVehiclePendingDelete(null);
      triggerRefresh();
      toastSuccess(
        target.assigned_driver_id
          ? `Tanker ${target.plate_number} removed from fleet and unassigned from its driver.`
          : `Tanker ${target.plate_number} removed from fleet.`
      );
    } catch (err) {
      toastError(err.message);
    }
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header & Sub-Navigation */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-5 border-b border-outline-variant/30 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 font-label-code text-[11px] text-secondary mb-1">
            <span>ADMINISTRATIVE GOVERNANCE</span>
            <span>/</span>
            <span className="text-primary font-semibold">FLEET & STAFF OPERATIONS</span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-primary tracking-tight font-semibold">
            Team, Fleet & Allowances
          </h1>
          <p className="font-body-md text-[13px] text-secondary mt-0.5">
            Manager command center: register drivers & tankers, configure credentials, set route clearances, and allocate daily food stipends.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeSubTab === 'staff' && (
            <button
              type="button"
              onClick={() => setIsStaffModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              <span>+ Add Staff / Driver</span>
            </button>
          )}

          {activeSubTab === 'fleet' && (
            <button
              type="button"
              onClick={() => setIsVehicleModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[16px]">local_shipping</span>
              <span>+ Add Fleet Vehicle</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Selector */}
      <div className="overflow-x-auto max-w-full pb-1 -mx-1 px-1 mb-6 border-b border-outline-variant/30">
        <div className="flex items-center gap-1 sm:gap-2 min-w-max">
          <button
            type="button"
            onClick={() => setActiveSubTab('staff')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeSubTab === 'staff'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">group</span>
            <span>Staff & Credentials ({staffProfiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('fleet')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeSubTab === 'fleet'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">local_shipping</span>
            <span>Fleet & Vehicles ({allVehicles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('corridors')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeSubTab === 'corridors'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">alt_route</span>
            <span>Route & Station Clearances</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('food')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors ${
              activeSubTab === 'food'
                ? 'border-primary text-primary font-semibold'
                : 'border-transparent text-secondary hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">restaurant</span>
            <span>Daily Food & Allowances</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: STAFF & CREDENTIALS */}
      {activeSubTab === 'staff' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">badge</span>
              </div>
              <div>
                <h3 className="font-title-lg text-[15px] font-bold text-primary">Carrier Personnel Directory</h3>
                <p className="text-[12px] text-secondary">
                  Managers can reset staff passwords, assign tankers, and establish subsistence allowance standards.
                </p>
              </div>
            </div>
            <span className="font-label-code text-[12px] text-secondary bg-surface-container-low px-2 py-1 rounded border border-outline-variant/30 shrink-0 self-start sm:self-auto">
              {staffProfiles.length} Registered Drivers
            </span>
          </div>

          {staffProfiles.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-8 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">person_off</span>
              <h3 className="font-title-lg text-lg font-bold text-primary">No staff profiles yet</h3>
              <p className="text-[13px] text-secondary mt-1 max-w-md mx-auto">
                No carrier staff or drivers have been added yet. Click "+ Add Staff / Driver" to register operating personnel.
              </p>
              <button
                type="button"
                onClick={() => setIsStaffModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                <span>+ Add Staff / Driver</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {staffProfiles.map((staff) => {
              const assignedVehicle = allVehicles.find((v) => v.assigned_driver_id === staff.id);
              const allowance = foodAllowances.find((f) => f.staff_id === staff.id);
              const assignedRouteIds = dataStore.getAssignedRouteIds(staff.id);
              const assignedStationIds = dataStore.getAssignedStationIds(staff.id);

              return (
                <div
                  key={staff.id}
                  className={`bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm transition-colors ${
                    staff.is_active === false ? 'opacity-70 border-dashed' : 'hover:border-outline-variant'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-outline-variant/20">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded bg-surface-container-high text-primary font-bold flex items-center justify-center border border-outline-variant/40">
                        <span className="material-symbols-outlined text-[22px]">person</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-title-lg text-[16px] font-bold text-primary">{staff.full_name}</h4>
                          <span className="font-label-code text-[10px] bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 rounded font-semibold uppercase">
                            Carrier Staff
                          </span>
                          {staff.is_active === false && (
                            <span className="font-label-code text-[10px] bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 rounded font-semibold uppercase inline-flex items-center gap-1">
                              <span className="material-symbols-outlined text-[12px]">block</span>
                              Deactivated
                            </span>
                          )}
                        </div>
                        <div className="font-label-code text-[12px] text-secondary flex items-center gap-3 mt-0.5">
                          <span>{staff.email}</span>
                          <span>·</span>
                          <span>{staff.phone || 'No phone recorded'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openResetPasswordModal(staff)}
                        disabled={staff.is_active === false}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-primary border border-outline-variant/30 text-[12px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-surface-container-low"
                        title="Reset Staff Login Password"
                      >
                        <span className="material-symbols-outlined text-[16px] text-amber-600">lock_reset</span>
                        <span>Reset Password</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openFoodModal(staff)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low hover:bg-surface-container text-primary border border-outline-variant/30 text-[12px] font-medium transition-colors"
                        title="Configure Daily Food Stipend"
                      >
                        <span className="material-symbols-outlined text-[16px] text-emerald-600">restaurant</span>
                        <span>Configure Food</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStaffActive(staff)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded border text-[12px] font-medium transition-colors ${
                          staff.is_active === false
                            ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-surface-container-low hover:bg-amber-50 text-on-surface-variant border-outline-variant/30'
                        }`}
                        title={
                          staff.is_active === false
                            ? 'Restore login access for this staff member'
                            : 'Revoke login access without deleting history'
                        }
                      >
                        <span className="material-symbols-outlined text-[16px]">
                          {staff.is_active === false ? 'how_to_reg' : 'person_off'}
                        </span>
                        <span>{staff.is_active === false ? 'Reactivate' : 'Deactivate'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStaffPendingDelete(staff)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-surface-container-low hover:bg-rose-50 text-on-surface-variant hover:text-rose-700 border border-outline-variant/30 hover:border-rose-300 text-[12px] font-medium transition-colors"
                        title="Permanently remove this staff member"
                      >
                        <span className="material-symbols-outlined text-[16px] text-rose-600">delete</span>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-4 text-[12px]">
                    <div>
                      <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-1">
                        Assigned Tanker
                      </span>
                      {assignedVehicle ? (
                        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-surface-container-low border border-outline-variant/30 font-label-code text-primary font-bold">
                          <span className="material-symbols-outlined text-[14px]">local_shipping</span>
                          <span>{assignedVehicle.plate_number}</span>
                        </div>
                      ) : (
                        <span className="text-secondary italic">No vehicle assigned</span>
                      )}
                    </div>

                    <div>
                      <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-1">
                        Daily Food / Travel
                      </span>
                      <div className="font-label-code text-on-surface">
                        <span className="font-bold text-emerald-800">
                          ₹{allowance ? allowance.daily_food_allowance : 500}
                        </span>{' '}
                        food +{' '}
                        <span className="text-secondary">
                          ₹{allowance ? allowance.daily_travel_allowance : 0} travel
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-1">
                        Route / Station Access
                      </span>
                      <div className="font-label-code text-on-surface">
                        <span className="font-semibold text-primary">{assignedRouteIds.length} routes</span> ·{' '}
                        <span className="font-semibold text-primary">{assignedStationIds.length} stations</span>
                      </div>
                    </div>

                    <div>
                      <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-1">
                        Login Access
                      </span>
                      <div className="font-label-code text-[11px]">
                        {staff.is_active === false ? (
                          <span className="text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                            Revoked
                          </span>
                        ) : (
                          <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Active
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: FLEET & VEHICLES */}
      {activeSubTab === 'fleet' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">local_shipping</span>
              </div>
              <div>
                <h3 className="font-title-lg text-[15px] font-bold text-primary">Fleet Assets & Vehicle Assignments</h3>
                <p className="text-[12px] text-secondary">
                  Rigid tankers, bulk trailers, and support vehicles. Assign dedicated drivers to enforce dispatch tracking.
                </p>
              </div>
            </div>
            <span className="font-label-code text-[12px] text-secondary bg-surface-container-low px-2 py-1 rounded border border-outline-variant/30 shrink-0 self-start sm:self-auto">
              {allVehicles.length} Registered Units
            </span>
          </div>

          {allVehicles.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-8 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">no_crash</span>
              <h3 className="font-title-lg text-lg font-bold text-primary">No fleet vehicles registered yet</h3>
              <p className="text-[13px] text-secondary mt-1 max-w-md mx-auto">
                No tankers or transport carriers have been registered. Click "+ Add Fleet Vehicle" to add tanker units.
              </p>
              <button
                type="button"
                onClick={() => setIsVehicleModalOpen(true)}
                className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
              >
                <span className="material-symbols-outlined text-[16px]">local_shipping</span>
                <span>+ Add Fleet Vehicle</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {allVehicles.map((veh) => {
                const assignedDriver = staffProfiles.find((s) => s.id === veh.assigned_driver_id);

                return (
                  <div
                    key={veh.id}
                    className="bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm space-y-4"
                  >
                    <div className="flex items-center justify-between pb-3 border-b border-outline-variant/20">
                      <div className="flex items-center gap-2.5">
                        <div className="px-2 py-1 bg-amber-50 border border-amber-300 rounded font-label-code text-[13px] font-bold text-amber-900 tracking-wider">
                          {veh.plate_number}
                        </div>
                        <span className="font-label-code text-[11px] text-secondary uppercase bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30">
                          {veh.vehicle_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-label-code text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          PESO Compliant
                        </span>
                        <button
                          type="button"
                          onClick={() => setVehiclePendingDelete(veh)}
                          className="w-7 h-7 rounded flex items-center justify-center text-secondary hover:text-rose-700 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors"
                          title={`Remove tanker ${veh.plate_number} from fleet`}
                          aria-label={`Delete vehicle ${veh.plate_number}`}
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-[12px]">
                      <div>
                        <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-0.5">
                          Model / Chassis
                        </span>
                        <div className="font-body-md text-on-surface font-medium">{veh.model || '—'}</div>
                      </div>

                      <div>
                        <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-0.5">
                          Gross Tank Capacity
                        </span>
                        <div className="font-label-code text-primary font-bold text-[13px]">
                          {Number(veh.capacity_liters || 0).toLocaleString()} Liters
                        </div>
                      </div>
                    </div>

                    {/* Driver Assignment Dropdown */}
                    <div className="pt-2 border-t border-outline-variant/20 flex flex-col gap-1.5">
                      <label className="font-label-caps text-[10px] text-secondary uppercase font-semibold">
                        Assigned Driver (Operator)
                      </label>
                      <div className="flex items-center gap-2">
                        <select
                          className="form-select text-[12px] flex-1 bg-surface-container-low border-outline-variant/30"
                          value={veh.assigned_driver_id || ''}
                          onChange={(e) => handleAssignVehicle(veh.id, e.target.value || null)}
                        >
                          <option value="">-- No Driver Assigned --</option>
                          {activeStaffProfiles.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.full_name} ({s.email})
                            </option>
                          ))}
                          {veh.assigned_driver_id &&
                            !activeStaffProfiles.some((s) => s.id === veh.assigned_driver_id) && (
                              <option value={veh.assigned_driver_id}>
                                {staffProfiles.find((s) => s.id === veh.assigned_driver_id)?.full_name ||
                                  'Deactivated driver'}{' '}
                                (inactive)
                              </option>
                            )}
                        </select>
                      </div>
                      {assignedDriver && (
                        <span className="font-label-code text-[11px] text-emerald-700">
                          ✓ Currently operated by {assignedDriver.full_name}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: CORRIDOR & STATION CLEARANCES */}
      {activeSubTab === 'corridors' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">alt_route</span>
              </div>
              <div>
                <h3 className="font-title-lg text-[15px] font-bold text-primary">Driver Route & Station Access Control</h3>
                <p className="text-[12px] text-secondary">
                  Strict isolation security: Drivers can ONLY see stations and routes that you check below. All others remain hidden.
                </p>
              </div>
            </div>
            <span className="font-label-code text-[11px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0 self-start sm:self-auto">
              Isolation Active
            </span>
          </div>

          {activeStaffProfiles.length === 0 ? (
            <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-8 text-center shadow-sm">
              <span className="material-symbols-outlined text-4xl text-outline mb-2">lock_clock</span>
              <h3 className="font-title-lg text-lg font-bold text-primary">No active staff members for access clearance</h3>
              <p className="text-[13px] text-secondary mt-1 max-w-md mx-auto">
                Corridor and station clearances are granted to carrier staff profiles. Register staff drivers to configure access permissions.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeStaffProfiles.map((staff) => {
                const assignedRouteIds = dataStore.getAssignedRouteIds(staff.id);
                const assignedStationIds = dataStore.getAssignedStationIds(staff.id);

                return (
                  <div
                    key={staff.id}
                    className="bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-outline-variant/20 gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded bg-primary text-on-primary flex items-center justify-center font-bold text-[14px]">
                          {staff.full_name.charAt(0)}
                        </div>
                        <div>
                          <h4 className="font-title-lg text-[15px] text-primary font-bold">{staff.full_name}</h4>
                          <div className="font-label-code text-[11px] text-secondary">{staff.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-label-code text-[11px] text-primary bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30">
                          {assignedRouteIds.length} Corridors Authorized
                        </span>
                        <span className="font-label-code text-[11px] text-primary bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30">
                          {assignedStationIds.length} Stations Authorized
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                      {/* Routes */}
                      <div className="bg-surface-container-low/40 p-3 rounded border border-outline-variant/20">
                        <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-2">
                          Authorized Corridors / Arteries
                        </span>
                        <div className="space-y-2">
                          {allRoutes.map((rt) => {
                            const isAssigned = assignedRouteIds.includes(rt.id);
                            return (
                              <label key={rt.id} className="flex items-center gap-2 cursor-pointer text-[12px] text-on-surface">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => handleToggleRoute(staff.id, rt.id)}
                                  className="rounded border-outline-variant text-primary focus:ring-primary"
                                />
                                <span className="font-medium">{rt.name}</span>
                                <span className="font-label-code text-[11px] text-secondary">({rt.route_code})</span>
                              </label>
                            );
                          })}
                          {allRoutes.length === 0 && (
                            <div className="text-[12px] text-secondary italic">No distribution corridors defined yet.</div>
                          )}
                        </div>
                      </div>

                      {/* Stations */}
                      <div className="bg-surface-container-low/40 p-3 rounded border border-outline-variant/20">
                        <span className="font-label-caps text-[10px] text-secondary uppercase font-semibold block mb-2">
                          Authorized Fuel Stations & Racks
                        </span>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                          {allStations.map((stn) => {
                            const isAssigned = assignedStationIds.includes(stn.id);
                            return (
                              <label key={stn.id} className="flex items-center gap-2 cursor-pointer text-[12px] text-on-surface">
                                <input
                                  type="checkbox"
                                  checked={isAssigned}
                                  onChange={() => handleToggleStation(staff.id, stn.id)}
                                  className="rounded border-outline-variant text-primary focus:ring-primary"
                                />
                                <span className="font-medium">{stn.name}</span>
                                <span className="font-label-code text-[11px] text-secondary">· {stn.city || 'Station'}</span>
                              </label>
                            );
                          })}
                          {allStations.length === 0 && (
                            <div className="text-[12px] text-secondary italic">No dispensing stations registered yet.</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 4: DAILY FOOD & ALLOWANCES */}
      {activeSubTab === 'food' && (
        <div className="space-y-4">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[20px]">restaurant</span>
              </div>
              <div>
                <h3 className="font-title-lg text-[15px] font-bold text-primary">Carrier Subsistence & Food Allowances</h3>
                <p className="text-[12px] text-secondary">
                  Managers set standard per diem food and transit compensation. Drivers log receipts against these budgets.
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="font-label-caps text-[10px] text-secondary uppercase block">Fleet Daily Food Budget</span>
              <span className="font-label-code text-[14px] font-bold text-emerald-800">
                ₹{foodAllowances.reduce((sum, f) => sum + (f.daily_food_allowance || 0), 0).toLocaleString()} / day
              </span>
            </div>
          </div>

          <div className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded overflow-x-auto shadow-sm">
            <table className="w-full min-w-[700px] text-left border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-outline-variant/30 bg-surface-container-low text-secondary font-label-caps text-[10px] uppercase">
                  <th className="p-3">Staff / Driver</th>
                  <th className="p-3">Assigned Vehicle</th>
                  <th className="p-3">Daily Food Allowance</th>
                  <th className="p-3">Daily Transit Allowance</th>
                  <th className="p-3">Effective Date</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20 font-label-code text-[12px]">
                {activeStaffProfiles.map((staff) => {
                  const allowance = foodAllowances.find((f) => f.staff_id === staff.id);
                  const assignedVehicle = allVehicles.find((v) => v.assigned_driver_id === staff.id);

                  return (
                    <tr key={staff.id} className="hover:bg-surface-container-low/50">
                      <td className="p-3 font-medium text-on-surface">
                        <div className="font-body-md text-[13px] font-bold text-primary">{staff.full_name}</div>
                        <div className="text-[11px] text-secondary">{staff.email}</div>
                      </td>
                      <td className="p-3">
                        {assignedVehicle ? (
                          <span className="px-2 py-0.5 rounded bg-surface-container-low border border-outline-variant/30 font-bold">
                            {assignedVehicle.plate_number}
                          </span>
                        ) : (
                          <span className="text-secondary italic">None</span>
                        )}
                      </td>
                      <td className="p-3 font-bold text-emerald-800">
                        ₹{allowance ? allowance.daily_food_allowance.toLocaleString() : '0'} / day
                      </td>
                      <td className="p-3 text-on-surface">
                        ₹{allowance ? allowance.daily_travel_allowance.toLocaleString() : '0'} / day
                      </td>
                      <td className="p-3 text-secondary">
                        {allowance?.effective_from || '—'}
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => openFoodModal(staff)}
                          className="px-2.5 py-1 rounded bg-surface-container-low hover:bg-surface-container text-primary border border-outline-variant/30 text-[11px] font-medium"
                        >
                          Modify Allowance
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {activeStaffProfiles.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center py-8 text-secondary font-body-md">
                      No staff members registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL 1: ADD STAFF */}
      <Modal isOpen={isStaffModalOpen} onClose={() => setIsStaffModalOpen(false)} title="Register Carrier Driver / Staff">
        <form onSubmit={handleCreateStaff} className="space-y-4">
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Full Name *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Full Name"
              value={staffForm.full_name}
              onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Email Address (Login ID) *</label>
            <input
              type="email"
              className="form-input"
              placeholder="staff@company.com"
              value={staffForm.email}
              onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Phone Number</label>
            <input
              type="tel"
              className="form-input"
              placeholder="+91..."
              value={staffForm.phone}
              onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Initial Login Password *</label>
            <input
              type="password"
              autoComplete="new-password"
              className="form-input font-label-code"
              placeholder="Minimum 8 characters"
              value={staffForm.initial_password}
              onChange={(e) => setStaffForm({ ...staffForm, initial_password: e.target.value })}
              required
              minLength={8}
            />
            <span className="text-[11px] text-secondary mt-0.5 block">
              At least 8 characters. Share it with the driver securely; you can reset it later from the staff table.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-outline-variant/30">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Daily Food Allowance (₹)</label>
              <input
                type="number"
                min="0"
                step="50"
                className="form-input font-label-code"
                value={staffForm.daily_food_allowance}
                onChange={(e) => setStaffForm({ ...staffForm, daily_food_allowance: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Daily Travel / Transit (₹)</label>
              <input
                type="number"
                min="0"
                step="50"
                className="form-input font-label-code"
                value={staffForm.daily_travel_allowance}
                onChange={(e) => setStaffForm({ ...staffForm, daily_travel_allowance: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsStaffModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Driver & Credentials
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: ADD VEHICLE */}
      <Modal isOpen={isVehicleModalOpen} onClose={() => setIsVehicleModalOpen(false)} title="Register Fleet Vehicle / Tanker">
        <form onSubmit={handleCreateVehicle} className="space-y-4">
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">License Registration Plate *</label>
            <input
              type="text"
              className="form-input font-label-code uppercase tracking-wider"
              placeholder="e.g. MH-12-AB-1234"
              value={vehicleForm.plate_number}
              onChange={(e) => setVehicleForm({ ...vehicleForm, plate_number: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Vehicle Type</label>
              <select
                className="form-select"
                value={vehicleForm.vehicle_type}
                onChange={(e) => setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })}
              >
                <option value="tanker">Rigid Tanker (HazChem)</option>
                <option value="trailer">Semi-Trailer Bulk Tanker</option>
                <option value="pickup">Escort / Inspection Pickup</option>
                <option value="van">Support Van</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Gross Capacity (Liters)</label>
              <input
                type="number"
                min="500"
                step="500"
                className="form-input font-label-code"
                placeholder="Capacity in Liters"
                value={vehicleForm.capacity_liters}
                onChange={(e) => setVehicleForm({ ...vehicleForm, capacity_liters: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Chassis / Make Model</label>
            <input
              type="text"
              className="form-input"
              placeholder="Make / Model"
              value={vehicleForm.model}
              onChange={(e) => setVehicleForm({ ...vehicleForm, model: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Initial Assigned Driver</label>
            <select
              className="form-select"
              value={vehicleForm.assigned_driver_id}
              onChange={(e) => setVehicleForm({ ...vehicleForm, assigned_driver_id: e.target.value })}
            >
              <option value="">-- Leave Unassigned for Pool --</option>
              {activeStaffProfiles.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.email})
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsVehicleModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Register Tanker to Fleet
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 3: RESET STAFF PASSWORD */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title={`Reset Password · ${selectedStaff?.full_name || ''}`}
      >
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div className="p-3 rounded bg-surface-container-low border border-outline-variant/30 text-[12px]">
            <div className="text-secondary font-label-caps text-[10px] uppercase font-semibold">Driver Account</div>
            <div className="font-bold text-primary text-[14px] mt-0.5">{selectedStaff?.full_name}</div>
            <div className="font-label-code text-secondary">{selectedStaff?.email}</div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={generateRandomPassword}
              className="text-[12px] text-primary hover:underline flex items-center gap-1 font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">auto_fix_high</span>
              <span>Generate Secure Temporary Password</span>
            </button>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">New Password *</label>
            <input
              type="password"
              autoComplete="new-password"
              className="form-input font-label-code"
              placeholder="Minimum 8 characters"
              value={passwordForm.new_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
              required
              minLength={8}
            />
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Confirm New Password *</label>
            <input
              type="password"
              autoComplete="new-password"
              className="form-input font-label-code"
              placeholder="Re-type new password"
              value={passwordForm.confirm_password}
              onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
              required
              minLength={8}
            />
            <span className="text-[11px] text-secondary mt-0.5 block">
              Share the new password with the driver over a trusted channel.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsPasswordModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Confirm & Update Password
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 4: CONFIGURE FOOD ALLOWANCE */}
      <Modal
        isOpen={isFoodModalOpen}
        onClose={() => setIsFoodModalOpen(false)}
        title={`Set Daily Allowance · ${selectedStaff?.full_name || ''}`}
      >
        <form onSubmit={handleSaveFoodAllowance} className="space-y-4">
          <div className="p-3 rounded bg-surface-container-low border border-outline-variant/30 text-[12px]">
            <div className="text-secondary font-label-caps text-[10px] uppercase font-semibold">Driver</div>
            <div className="font-bold text-primary text-[14px] mt-0.5">{selectedStaff?.full_name}</div>
            <div className="font-label-code text-secondary">{selectedStaff?.email}</div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Daily Food & Meal Allowance (₹ / day) *</label>
            <div className="flex items-center gap-2">
              <span className="font-label-code text-[14px] text-secondary">₹</span>
              <input
                type="number"
                min="0"
                step="50"
                className="form-input font-label-code flex-1"
                value={foodForm.daily_food_allowance}
                onChange={(e) => setFoodForm({ ...foodForm, daily_food_allowance: e.target.value })}
                required
              />
            </div>
            <span className="text-[11px] text-secondary mt-0.5 block">
              Budgeted daily meal reimbursement for line-haul driving shifts.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Daily Transit / Travel Allowance (₹ / day)</label>
            <div className="flex items-center gap-2">
              <span className="font-label-code text-[14px] text-secondary">₹</span>
              <input
                type="number"
                min="0"
                step="50"
                className="form-input font-label-code flex-1"
                value={foodForm.daily_travel_allowance}
                onChange={(e) => setFoodForm({ ...foodForm, daily_travel_allowance: e.target.value })}
              />
            </div>
            <span className="text-[11px] text-secondary mt-0.5 block">
              Incidental transit expenses, toll card top-up or local transit stipends.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-outline-variant/20">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsFoodModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Allowance Standard
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 5: CONFIRM DELETE STAFF */}
      <Modal
        isOpen={Boolean(staffPendingDelete)}
        onClose={() => setStaffPendingDelete(null)}
        title="Confirm Staff Removal"
        maxWidth="470px"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded text-rose-900 text-[13px]">
            <span className="material-symbols-outlined text-rose-600 text-[22px] shrink-0 mt-0.5">warning</span>
            <div>
              <p className="font-semibold text-rose-800">Permanent Staff Removal</p>
              <p className="mt-0.5 text-rose-700 leading-relaxed">
                Remove <strong className="text-rose-950 font-bold">{staffPendingDelete?.full_name}</strong> (
                {staffPendingDelete?.email}) from the carrier directory?
              </p>
            </div>
          </div>

          {staffPendingDelete && dataStore.getStaffHistoryCount(staffPendingDelete.id) > 0 ? (
            <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 text-[12px]">
              <span className="material-symbols-outlined text-[18px] text-amber-600 shrink-0 mt-0.5">lock</span>
              <p className="leading-relaxed">
                This profile owns{' '}
                <strong className="font-bold">{dataStore.getStaffHistoryCount(staffPendingDelete.id)}</strong>{' '}
                historical record(s) (deliveries, advances, or expenses) so it cannot be erased. Use{' '}
                <strong className="font-bold">Deactivate</strong> instead to revoke login access while the history stays
                intact.
              </p>
            </div>
          ) : (
            <p className="text-[12px] text-secondary leading-relaxed font-label-code">
              This also removes their login credentials, daily allowance standard, and all route/station access
              clearances. Any vehicle they drive will be returned to the unassigned pool.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setStaffPendingDelete(null)}
            >
              Cancel
            </button>
            {staffPendingDelete && dataStore.getStaffHistoryCount(staffPendingDelete.id) > 0 ? (
              <button
                type="button"
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[13px] font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                onClick={() => {
                  const target = staffPendingDelete;
                  setStaffPendingDelete(null);
                  handleToggleStaffActive({ ...target, is_active: false });
                }}
              >
                <span className="material-symbols-outlined text-[16px]">person_off</span>
                <span>Deactivate Instead</span>
              </button>
            ) : (
              <button
                type="button"
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[13px] font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                onClick={handleConfirmDeleteStaff}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                <span>Confirm Delete</span>
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* MODAL 6: CONFIRM DELETE VEHICLE */}
      <Modal
        isOpen={Boolean(vehiclePendingDelete)}
        onClose={() => setVehiclePendingDelete(null)}
        title="Confirm Tanker Removal"
        maxWidth="470px"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded text-rose-900 text-[13px]">
            <span className="material-symbols-outlined text-rose-600 text-[22px] shrink-0 mt-0.5">warning</span>
            <div>
              <p className="font-semibold text-rose-800">Permanent Tanker Removal</p>
              <p className="mt-0.5 text-rose-700 leading-relaxed">
                Remove tanker{' '}
                <strong className="text-rose-950 font-bold">{vehiclePendingDelete?.plate_number}</strong> (
                {vehiclePendingDelete?.vehicle_type}) from the fleet register?
              </p>
            </div>
          </div>

          <p className="text-[12px] text-secondary leading-relaxed font-label-code">
            {vehiclePendingDelete?.assigned_driver_id
              ? 'This tanker is currently assigned to a driver and will be returned to the unassigned pool. Past factory intake and fuel consumption logs are preserved.'
              : 'Past factory intake and fuel consumption logs are preserved for reporting.'}
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setVehiclePendingDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[13px] font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              onClick={handleConfirmDeleteVehicle}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
