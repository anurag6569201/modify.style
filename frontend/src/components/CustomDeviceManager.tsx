import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Save, Smartphone, Tablet, Laptop } from 'lucide-react';
import { storage } from '../utils/storage';
import type { CustomDevice } from '../utils/storage';
import './CustomDeviceManager.css';

interface CustomDeviceManagerProps {
  onDeviceSelect?: (device: CustomDevice) => void;
  onClose?: () => void;
  onDevicesChange?: (devices: CustomDevice[]) => void;
}

export default function CustomDeviceManager({ onDeviceSelect, onClose, onDevicesChange }: CustomDeviceManagerProps) {
  const [devices, setDevices] = useState<CustomDevice[]>([]);
  const [editingDevice, setEditingDevice] = useState<CustomDevice | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'mobile' as 'mobile' | 'tablet' | 'laptop',
    width: 375,
    height: 667,
  });

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = () => {
    setDevices(storage.getCustomDevices());
  };

  const saveDevices = (newDevices: CustomDevice[]) => {
    setDevices(newDevices);
    storage.saveCustomDevices(newDevices);
    if (onDevicesChange) {
      onDevicesChange(newDevices);
    }
  };

  const handleAdd = () => {
    setEditingDevice(null);
    setFormData({
      name: '',
      type: 'mobile',
      width: 375,
      height: 667,
    });
    setShowForm(true);
  };

  const handleEdit = (device: CustomDevice) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      type: device.type,
      width: device.width,
      height: device.height,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this custom device?')) {
      const updated = devices.filter(d => d.id !== id);
      saveDevices(updated);
    }
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      alert('Please enter a device name');
      return;
    }

    if (formData.width <= 0 || formData.height <= 0) {
      alert('Width and height must be greater than 0');
      return;
    }

    if (editingDevice) {
      // Update existing
      const updated = devices.map(d =>
        d.id === editingDevice.id
          ? { ...formData, id: editingDevice.id }
          : d
      );
      saveDevices(updated);
    } else {
      // Add new
      const newDevice: CustomDevice = {
        ...formData,
        id: `custom-${Date.now()}`,
      };
      saveDevices([...devices, newDevice]);
    }

    setShowForm(false);
    setEditingDevice(null);
  };

  const handleSelect = (device: CustomDevice) => {
    if (onDeviceSelect) {
      onDeviceSelect(device);
    }
    if (onClose) {
      onClose();
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone size={16} />;
      case 'tablet':
        return <Tablet size={16} />;
      case 'laptop':
        return <Laptop size={16} />;
      default:
        return <Smartphone size={16} />;
    }
  };

  const getPresetDimensions = (type: string) => {
    switch (type) {
      case 'mobile':
        return { width: 375, height: 667 };
      case 'tablet':
        return { width: 768, height: 1024 };
      case 'laptop':
        return { width: 1366, height: 768 };
      default:
        return { width: 375, height: 667 };
    }
  };

  const handleTypeChange = (type: 'mobile' | 'tablet' | 'laptop') => {
    const preset = getPresetDimensions(type);
    setFormData({ ...formData, type, width: preset.width, height: preset.height });
  };

  if (showForm) {
    return (
      <div className="custom-device-form">
        <div className="form-header">
          <h3>{editingDevice ? 'Edit Device' : 'Add Custom Device'}</h3>
          <button className="form-close-btn" onClick={() => setShowForm(false)}>
            <X size={16} />
          </button>
        </div>

        <div className="form-content">
          <div className="form-group">
            <label>Device Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., iPhone 15 Pro"
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label>Device Type</label>
            <div className="type-buttons">
              <button
                className={`type-btn ${formData.type === 'mobile' ? 'active' : ''}`}
                onClick={() => handleTypeChange('mobile')}
              >
                <Smartphone size={16} />
                <span>Mobile</span>
              </button>
              <button
                className={`type-btn ${formData.type === 'tablet' ? 'active' : ''}`}
                onClick={() => handleTypeChange('tablet')}
              >
                <Tablet size={16} />
                <span>Tablet</span>
              </button>
              <button
                className={`type-btn ${formData.type === 'laptop' ? 'active' : ''}`}
                onClick={() => handleTypeChange('laptop')}
              >
                <Laptop size={16} />
                <span>Laptop</span>
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Width (px)</label>
              <input
                type="number"
                value={formData.width}
                onChange={(e) => setFormData({ ...formData, width: parseInt(e.target.value) || 0 })}
                min="100"
                max="5000"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label>Height (px)</label>
              <input
                type="number"
                value={formData.height}
                onChange={(e) => setFormData({ ...formData, height: parseInt(e.target.value) || 0 })}
                min="100"
                max="5000"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-actions">
            <button className="form-btn cancel" onClick={() => setShowForm(false)}>
              Cancel
            </button>
            <button className="form-btn save" onClick={handleSave}>
              <Save size={16} />
              <span>{editingDevice ? 'Update' : 'Add'} Device</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="custom-device-manager">
      <div className="manager-header">
        <button className="add-device-btn" onClick={handleAdd}>
          <Plus size={16} />
          <span>Add Device</span>
        </button>
      </div>

      <div className="devices-list">
        {devices.length === 0 ? (
          <div className="empty-devices">
            <p>No custom devices yet</p>
            <button className="add-first-btn" onClick={handleAdd}>
              <Plus size={16} />
              <span>Add Your First Device</span>
            </button>
          </div>
        ) : (
          devices.map((device) => (
            <div key={device.id} className="device-item">
              <div className="device-info" onClick={() => handleSelect(device)}>
                <div className="device-icon">{getTypeIcon(device.type)}</div>
                <div className="device-details">
                  <div className="device-name">{device.name}</div>
                  <div className="device-specs">
                    {device.width} × {device.height}px
                  </div>
                </div>
              </div>
              <div className="device-actions">
                <button
                  className="action-btn edit"
                  onClick={() => handleEdit(device)}
                  title="Edit"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  className="action-btn delete"
                  onClick={() => handleDelete(device.id)}
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
