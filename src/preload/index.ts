import { contextBridge, ipcRenderer } from 'electron'
import type { PassApi } from '@shared/types'

const api: PassApi = {
  classes: {
    list: () => ipcRenderer.invoke('classes:list'),
    create: input => ipcRenderer.invoke('classes:create', input),
    update: (classId, patch) => ipcRenderer.invoke('classes:update', classId, patch),
    chooseImportFile: () => ipcRenderer.invoke('classes:choose-import'),
    importPreview: filePath => ipcRenderer.invoke('classes:preview-import', filePath),
    importClass: input => ipcRenderer.invoke('classes:import', input),
    delete: classId => ipcRenderer.invoke('classes:delete', classId)
  },
  students: { list: classId => ipcRenderer.invoke('students:list', classId) },
  attendance: {
    scan: input => ipcRenderer.invoke('attendance:scan', input),
    list: (classId, date) => ipcRenderer.invoke('attendance:list', classId, date),
    setManual: input => ipcRenderer.invoke('attendance:set-manual', input)
  },
  scanLog: {
    list: input => ipcRenderer.invoke('scan-log:list', input),
    exportXlsx: input => ipcRenderer.invoke('scan-log:export-xlsx', input)
  },
  exports: {
    updateClassRecord: input => ipcRenderer.invoke('exports:update-class-record', input),
    outputQrSheet: input => ipcRenderer.invoke('exports:output-qr-sheet', input)
  },
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    save: patch => ipcRenderer.invoke('settings:save', patch),
    setPin: value => ipcRenderer.invoke('settings:set-pin', value),
    verifyPin: value => ipcRenderer.invoke('settings:verify-pin', value)
  }
}
contextBridge.exposeInMainWorld('pass', api)
