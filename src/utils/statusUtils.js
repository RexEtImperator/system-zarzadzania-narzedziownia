// A simple helper for calculating the displayed status and border color
// Maintains the existing logic in Tools and Health and Safety

export function getToolStatusInfo(tool) {
  const displayStatus = (tool?.quantity === 1 && (tool?.service_quantity || 0) > 0)
    ? 'serwis'
    : (tool?.status || 'nieznany');

  const statusBorderColor = displayStatus === 'dostępne'
    ? '#22c55e' // green-500
    : displayStatus === 'wydane'
    ? '#eab308' // yellow-500
    : displayStatus === 'serwis'
    ? '#ef4444' // red-500
    : '#94a3b8'; // slate-400

  return { displayStatus, statusBorderColor };
}

export function getBhpStatusInfo(item, t) {
  const displayStatus = item?.status || (t ? t('bhp.status.unknown') : 'nieznany');

  const statusBorderColor = displayStatus === 'dostępne'
    ? '#22c55e' // green-500
    : displayStatus === 'wydane'
    ? '#eab308' // yellow-500
    : '#94a3b8'; // slate-400

  return { displayStatus, statusBorderColor };
}