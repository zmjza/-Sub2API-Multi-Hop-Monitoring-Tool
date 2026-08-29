type ServerSwitchState = {
  status: 'idle' | 'opening' | 'open' | 'error';
  target?: { id: string };
};

export function canSwitchSub2ApiServer(state: ServerSwitchState, targetId: string): boolean {
  return (state.status === 'open' || state.status === 'error') && state.target?.id !== targetId;
}
