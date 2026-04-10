import React, { createContext, useContext, useState, useCallback } from "react";

const CallContext = createContext();

export function useCallData() {
  return useContext(CallContext);
}

export function CallProvider({ children }) {
  const [calledNumbers, setCalledNumbers] = useState([]);
  const [callDetails, setCallDetails] = useState({});
  const [totalCalls, setTotalCalls] = useState(0);
  const [loadingCalls, setLoadingCalls] = useState(false);

  // Merge new call data with old — purana history nahi jayega
  const mergeCallData = useCallback((newNumbers, newDetails) => {
    setCalledNumbers((prev) => {
      const merged = [...new Set([...prev, ...newNumbers])];
      return merged;
    });
    setCallDetails((prev) => {
      const merged = { ...prev };
      Object.keys(newDetails).forEach((num) => {
        // answered status ko priority do
        if (!merged[num] || newDetails[num].status === "answered") {
          merged[num] = newDetails[num];
        }
      });
      return merged;
    });
  }, []);

  // Fetch calls from Tata Tele API and merge with existing data
  const fetchCalls = useCallback(async () => {
    setLoadingCalls(true);
    try {
      const res = await fetch(
        `${process.env.REACT_APP_API_URL}/api/tatatele/calls`
      );
      const calls = await res.json();
      const newNumbers = calls.calledNumbers || [];
      const newDetails = calls.callDetails || {};
      setTotalCalls(calls.totalCalls || 0);
      mergeCallData(newNumbers, newDetails);
      return calls;
    } catch (err) {
      console.error("Call data fetch error:", err);
      throw err;
    } finally {
      setLoadingCalls(false);
    }
  }, [mergeCallData]);

  const value = {
    calledNumbers,
    callDetails,
    totalCalls,
    loadingCalls,
    fetchCalls,
    mergeCallData,
  };

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
