export const sendPushNotification = async (tokens: string[], title: string, body: string, data?: any) => {
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens,
        title,
        body,
        data: data || {},
      }),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to send notification');
    }
    return result;
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    return { success: false, error };
  }
};
