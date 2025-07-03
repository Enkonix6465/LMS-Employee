// utils/network.ts
export const getLocalIP = async (): Promise<string | null> => {
  return new Promise((resolve) => {
    const RTCPeerConnection =
      window.RTCPeerConnection ||
      (window as any).mozRTCPeerConnection ||
      (window as any).webkitRTCPeerConnection;

    if (!RTCPeerConnection) return resolve(null);

    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel("");
    pc.createOffer().then((offer) => pc.setLocalDescription(offer));

    pc.onicecandidate = (ice) => {
      if (ice && ice.candidate && ice.candidate.candidate) {
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const ipMatch = ice.candidate.candidate.match(ipRegex);
        if (ipMatch) {
          resolve(ipMatch[1]);
          pc.close();
        }
      }
    };

    setTimeout(() => {
      resolve(null);
    }, 2000);
  });
};
