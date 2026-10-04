import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { dataStore } from '../lib/dataStore';
import Modal from '../components/Modal';

export default function RoutesStationsView() {
  const { currentUser, isManager, triggerRefresh } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();
  const filteredData = dataStore.getFilteredData(currentUser);

  const [activeSubTab, setActiveSubTab] = useState('routes'); // 'routes' | 'stations'
  const [isRouteModalOpen, setIsRouteModalOpen] = useState(false);
  const [isEditRouteModalOpen, setIsEditRouteModalOpen] = useState(false);
  const [routeToDelete, setRouteToDelete] = useState(null);
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);

  const [routeForm, setRouteForm] = useState({
    route_code: '',
    name: '',
    description: '',
  });

  const [editRouteForm, setEditRouteForm] = useState({
    id: '',
    route_code: '',
    name: '',
    description: '',
  });

  const [stationForm, setStationForm] = useState({
    station_code: '',
    name: '',
    route_id: '',
    customer_id: '',
    address: '',
    contact_person: '',
    contact_phone: '',
  });

  const handleCreateRoute = async (e) => {
    e.preventDefault();
    if (!isManager) {
      toastError('Access Denied: Only Operations Managers can create distribution routes.');
      return;
    }
    if (!routeForm.route_code || !routeForm.name) {
      toastError('Route code and name are required.');
      return;
    }
    try {
      await dataStore.createRoute(routeForm, currentUser);
      setIsRouteModalOpen(false);
      setRouteForm({ route_code: '', name: '', description: '' });
      triggerRefresh();
      toastSuccess('Distribution corridor created successfully!');
    } catch (err) {
      toastError('Failed to create route: ' + err.message);
    }
  };

  const handleOpenEditRoute = (rt) => {
    setEditRouteForm({
      id: rt.id,
      route_code: rt.route_code || '',
      name: rt.name || '',
      description: rt.description || '',
    });
    setIsEditRouteModalOpen(true);
  };

  const handleUpdateRoute = async (e) => {
    e.preventDefault();
    if (!isManager) {
      toastError('Access Denied: Only Operations Managers can edit distribution routes.');
      return;
    }
    if (!editRouteForm.route_code || !editRouteForm.name) {
      toastError('Route code and corridor name are required.');
      return;
    }
    try {
      await dataStore.updateRoute(editRouteForm.id, editRouteForm, currentUser);
      setIsEditRouteModalOpen(false);
      triggerRefresh();
      toastSuccess('Distribution corridor updated successfully!');
    } catch (err) {
      toastError('Failed to update route: ' + err.message);
    }
  };

  const handleDeleteRoute = (rt) => {
    if (!isManager) {
      toastError('Access Denied: Only Operations Managers can delete distribution routes.');
      return;
    }
    setRouteToDelete(rt);
  };

  const handleConfirmDeleteRoute = async () => {
    if (!routeToDelete) return;
    const deletedName = routeToDelete.name;
    try {
      await dataStore.deleteRoute(routeToDelete.id, currentUser);
      setRouteToDelete(null);
      triggerRefresh();
      toastSuccess(`Distribution corridor "${deletedName}" deleted successfully.`);
    } catch (err) {
      toastError('Cannot delete route: ' + err.message);
    }
  };

  const handleOpenStationModal = () => {
    if (!isManager) {
      toastError('Access Denied: Only Operations Managers can add dispensing stations.');
      return;
    }
    setStationForm({
      station_code: '',
      name: '',
      route_id: filteredData.routes[0]?.id || '',
      customer_id: filteredData.customers[0]?.id || '',
      address: '',
      contact_person: '',
      contact_phone: '',
    });
    setIsStationModalOpen(true);
  };

  const handleCreateStation = async (e) => {
    e.preventDefault();
    if (!isManager) {
      toastError('Access Denied: Only Operations Managers can register dispensing stations.');
      return;
    }
    if (!stationForm.station_code || !stationForm.name || !stationForm.route_id || !stationForm.customer_id) {
      toastError('Station code, name, route, and customer are required.');
      return;
    }
    try {
      await dataStore.createStation(stationForm, currentUser);
      setIsStationModalOpen(false);
      triggerRefresh();
      toastSuccess('Dispensing station registered successfully!');
    } catch (err) {
      toastError('Failed to create station: ' + err.message);
    }
  };

  // Staff sees ONLY what is assigned to them.
  // Manager sees all routes/stations (or default sample corridors if brand new).
  const visibleRoutes = filteredData.routes;
  const visibleStations = filteredData.stations;

  return (
    <div className="flex flex-col w-full">
      {/* Title & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-end justify-between pb-5 border-b border-outline-variant/30 gap-4 mb-6">
        <div>
          <div className="flex items-center gap-1.5 font-label-code text-[11px] text-secondary mb-1">
            <span>INFRASTRUCTURE & LOGISTICS</span>
            <span>/</span>
            <span className="text-primary font-semibold">
              {isManager ? 'ALL CORRIDORS & TERMINALS' : 'ASSIGNED CORRIDORS & STATIONS'}
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl lg:text-3xl text-primary tracking-tight font-semibold">
            Routes & Stations
          </h1>
          <p className="font-body-md text-[13px] text-secondary mt-0.5">
            {isManager
              ? 'Complete corridor administration: manage distribution arteries, terminals, and storage tank capacities.'
              : `Logged in as ${currentUser?.full_name || 'Staff'}. Viewing strictly authorized routes and stations.`}
          </p>
        </div>

        {/* Action Buttons: Manager Exclusive */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-0.5 rounded bg-surface-container-low border border-outline-variant/30">
            <button
              type="button"
              onClick={() => setActiveSubTab('routes')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-sm transition-colors ${
                activeSubTab === 'routes'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Corridors ({visibleRoutes.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('stations')}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-sm transition-colors ${
                activeSubTab === 'stations'
                  ? 'bg-primary text-on-primary font-semibold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              Stations ({visibleStations.length})
            </button>
          </div>

          {/* MANAGER ONLY BUTTONS */}
          {isManager && (
            <>
              {activeSubTab === 'routes' ? (
                <button
                  type="button"
                  onClick={() => setIsRouteModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>+ Add Route</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleOpenStationModal}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  <span>+ Add Station</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Staff Isolation Notice */}
      {!isManager && (
        <div className="p-3 bg-surface-container-low border border-outline-variant/30 rounded mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[12px] font-label-code">
          <div className="flex items-center gap-2 text-primary font-medium">
            <span className="material-symbols-outlined text-[16px] text-emerald-700 shrink-0">security</span>
            <span>RLS Active: Strictly isolated to your {visibleRoutes.length} assigned corridor(s) and {visibleStations.length} station(s).</span>
          </div>
          <span className="text-secondary text-[11px] sm:text-[12px]">Unauthorized corridors are protected</span>
        </div>
      )}

      {/* Empty State when no routes */}
      {visibleRoutes.length === 0 && activeSubTab === 'routes' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">alt_route</span>
          <h3 className="font-title-lg text-lg font-bold text-primary">No distribution corridors yet</h3>
          <p className="text-[13px] text-secondary mt-1 max-w-md mx-auto">
            {isManager
              ? 'No routes have been created yet. Click "+ Add Route" to establish your first distribution corridor.'
              : 'You are currently not assigned to any distribution corridors. Please contact your Operations Manager.'}
          </p>
          {isManager && (
            <button
              type="button"
              onClick={() => setIsRouteModalOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>+ Add Route</span>
            </button>
          )}
        </div>
      )}

      {/* Empty State when no stations */}
      {visibleStations.length === 0 && activeSubTab === 'stations' && (
        <div className="bg-surface-container-lowest border border-outline-variant/30 rounded p-8 text-center shadow-sm">
          <span className="material-symbols-outlined text-4xl text-outline mb-2">local_gas_station</span>
          <h3 className="font-title-lg text-lg font-bold text-primary">No stock records available</h3>
          <p className="text-[13px] text-secondary mt-1 max-w-md mx-auto">
            {isManager
              ? 'No dispensing stations or stock records have been registered yet. Click "+ Add Station" to register a terminal.'
              : 'You are currently not assigned to any fuel dispensing stations.'}
          </p>
          {isManager && (
            <button
              type="button"
              onClick={handleOpenStationModal}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-on-primary rounded text-[13px] font-medium shadow-sm hover:bg-primary-container"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>+ Add Station</span>
            </button>
          )}
        </div>
      )}

      {/* Routes Grid */}
      {activeSubTab === 'routes' && visibleRoutes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleRoutes.map((rt) => (
            <div
              key={rt.id}
              className="bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-label-code text-[11px] font-bold text-primary bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30">
                    {rt.route_code || 'CORRIDOR'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[11px] font-label-code text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
                      ACTIVE
                    </span>
                    {isManager && (
                      <div className="flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditRoute(rt)}
                          className="p-1 text-primary hover:text-primary-container bg-surface-container-low hover:bg-surface-container border border-outline-variant/40 rounded transition-colors"
                          title="Edit Corridor Details"
                        >
                          <span className="material-symbols-outlined text-[15px] block">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRoute(rt)}
                          className="p-1 text-rose-600 hover:text-white bg-rose-50 hover:bg-rose-600 border border-rose-200 rounded transition-colors"
                          title="Delete Corridor"
                        >
                          <span className="material-symbols-outlined text-[15px] block">delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <h3 className="font-title-lg text-[16px] text-primary font-bold mb-1">{rt.name}</h3>
                <p className="font-body-md text-[13px] text-secondary mb-4 leading-relaxed">{rt.description || 'Designated industrial fuel transit corridor.'}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-outline-variant/20 font-label-code text-[12px]">
                <div>
                  <span className="text-secondary text-[10px] uppercase block">Stations Attached</span>
                  <span className="text-primary font-semibold">
                    {filteredData.stations.filter((s) => s.route_id === rt.id).length} stations
                  </span>
                </div>
                <div>
                  <span className="text-secondary text-[10px] uppercase block">Access Permission</span>
                  <span className="text-emerald-700 font-semibold">Authorized</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stations Grid */}
      {activeSubTab === 'stations' && visibleStations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleStations.map((stn) => {
            const currentStock = Number(stn.current_stock) || 0;
            const capacity = Number(stn.capacity) || 0;
            const fillPercent = capacity > 0 ? Math.round((currentStock / capacity) * 100) : 0;

            return (
              <div
                key={stn.id}
                className="bg-surface-container-lowest border border-outline-variant/30 rounded p-5 shadow-sm hover:border-primary/40 transition-colors flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-label-code text-[11px] font-bold text-primary bg-surface-container-low px-2 py-0.5 rounded border border-outline-variant/30">
                      {stn.station_code || 'DEPOT'}
                    </span>
                    <span className="font-label-code text-[11px] text-primary font-semibold">
                      {fillPercent}% Safe Fill
                    </span>
                  </div>
                  <h3 className="font-title-lg text-[16px] text-primary font-bold mb-1">{stn.name}</h3>
                  <p className="font-body-md text-[12px] text-secondary mb-3">{stn.address || 'Corridor dispensing rack.'}</p>

                  <div className="flex flex-col space-y-1 mb-4">
                    <div className="w-full h-2.5 bg-surface-container-low border border-outline-variant/30 overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${fillPercent}%` }}></div>
                    </div>
                    <div className="flex justify-between font-label-code text-[11px] text-secondary">
                      <span>Stock: {currentStock.toLocaleString()} L</span>
                      <span>Cap: {capacity > 0 ? `${capacity.toLocaleString()} L` : '—'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-outline-variant/20 font-label-code text-[12px]">
                  <div>
                    <span className="text-secondary text-[10px] block">Supervisor</span>
                    <span className="text-primary font-medium">{stn.contact_person || '—'}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-secondary text-[10px] block">Contact</span>
                    <span className="text-primary font-medium">{stn.contact_phone || '—'}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Route Modal (Manager Only) */}
      <Modal isOpen={isRouteModalOpen} onClose={() => setIsRouteModalOpen(false)} title="Create Distribution Corridor (Manager Only)">
        <form onSubmit={handleCreateRoute} className="space-y-4">
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Route Code</label>
            <input
              type="text"
              className="form-input uppercase"
              placeholder="e.g. RT-01"
              value={routeForm.route_code}
              onChange={(e) => setRouteForm({ ...routeForm, route_code: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Corridor Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Corridor / Route Name"
              value={routeForm.name}
              onChange={(e) => setRouteForm({ ...routeForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Route Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Origin terminal, intermediate racks, hazchem bypass routes..."
              value={routeForm.description}
              onChange={(e) => setRouteForm({ ...routeForm, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsRouteModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Route to Supabase
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Route Modal (Manager Only) */}
      <Modal isOpen={isEditRouteModalOpen} onClose={() => setIsEditRouteModalOpen(false)} title="Edit Distribution Corridor (Manager Only)">
        <form onSubmit={handleUpdateRoute} className="space-y-4">
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Route Code</label>
            <input
              type="text"
              className="form-input uppercase font-label-code"
              placeholder="e.g. RT-01"
              value={editRouteForm.route_code}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, route_code: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Corridor Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Corridor / Route Name"
              value={editRouteForm.name}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, name: e.target.value })}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Route Description</label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Origin terminal, intermediate racks, hazchem bypass routes..."
              value={editRouteForm.description}
              onChange={(e) => setEditRouteForm({ ...editRouteForm, description: e.target.value })}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsEditRouteModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Update Corridor & Save
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Confirm Delete Route Corridor (Manager Only) */}
      <Modal
        isOpen={Boolean(routeToDelete)}
        onClose={() => setRouteToDelete(null)}
        title="Confirm Delete Corridor"
        maxWidth="460px"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-3 bg-rose-50 border border-rose-200 rounded text-rose-900 text-[13px]">
            <span className="material-symbols-outlined text-rose-600 text-[22px] shrink-0 mt-0.5">warning</span>
            <div>
              <p className="font-semibold text-rose-800">Permanent Corridor Removal</p>
              <p className="mt-0.5 text-rose-700 leading-relaxed">
                Are you sure you want to delete corridor <strong className="text-rose-950 font-bold">{routeToDelete?.name}</strong> ({routeToDelete?.route_code || 'CORRIDOR'})?
              </p>
            </div>
          </div>

          <p className="text-[12px] text-secondary leading-relaxed font-label-code">
            Corridors with dispensing stations or delivery manifests attached cannot be removed until stations are reassigned.
          </p>

          <div className="flex justify-end gap-2 pt-2 border-t border-outline-variant/30">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setRouteToDelete(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-[13px] font-semibold transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              onClick={handleConfirmDeleteRoute}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              <span>Confirm Delete</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Station Modal (Manager Only) */}
      <Modal isOpen={isStationModalOpen} onClose={() => setIsStationModalOpen(false)} title="Register Dispensing Terminal (Manager Only)">
        <form onSubmit={handleCreateStation} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Terminal Code</label>
              <input
                type="text"
                className="form-input uppercase"
                placeholder="e.g. STN-01"
                value={stationForm.station_code}
                onChange={(e) => setStationForm({ ...stationForm, station_code: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Station Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Dispensing Station Name"
                value={stationForm.name}
                onChange={(e) => setStationForm({ ...stationForm, name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Assigned Corridor</label>
              <select
                className="form-select"
                value={stationForm.route_id}
                onChange={(e) => setStationForm({ ...stationForm, route_id: e.target.value })}
                required
              >
                {dataStore.routes.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Customer Consignee</label>
              <select
                className="form-select"
                value={stationForm.customer_id}
                onChange={(e) => setStationForm({ ...stationForm, customer_id: e.target.value })}
                required
              >
                {dataStore.customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label font-medium text-[13px]">Terminal Physical Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="Physical street address..."
              value={stationForm.address}
              onChange={(e) => setStationForm({ ...stationForm, address: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Lead Supervisor</label>
              <input
                type="text"
                className="form-input"
                placeholder="Supervisor Name"
                value={stationForm.contact_person}
                onChange={(e) => setStationForm({ ...stationForm, contact_person: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label font-medium text-[13px]">Contact Phone</label>
              <input
                type="text"
                className="form-input"
                placeholder="+91..."
                value={stationForm.contact_phone}
                onChange={(e) => setStationForm({ ...stationForm, contact_phone: e.target.value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsStationModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Save Station to Supabase
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
