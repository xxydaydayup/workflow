import { create } from 'zustand'

interface EditorState {
  selectedNodeId: string | null
  setSelectedNodeId: (nodeId: string | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedNodeId: null,
  setSelectedNodeId: (selectedNodeId) => set({ selectedNodeId }),
}))
