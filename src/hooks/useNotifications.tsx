import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { Notification, NotificationSettings } from '@/lib/notifications';
import {
  getDueDateReminders,
  getLowBalanceAlerts,
  requestNotificationPermission,
  showSystemNotification,
} from '@/lib/notifications';

export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<NotificationSettings>({
    billReminders: true,
    transactionAlerts: true,
    budgetAlerts: true,
    dueDateReminders: 3, // days before due date
  });
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notification settings
  useEffect(() => {
    if (!user) return;

    const loadSettings = async () => {
      const { data } = await supabase
        .from('user_settings')
        .select('notifications')
        .eq('user_id', user.id)
        .single();

      if (data?.notifications !== undefined) {
        setSettings(prev => ({ ...prev, billReminders: data.notifications }));
      }
    };

    loadSettings();
  }, [user]);

  // Check for notifications
  const checkNotifications = useCallback(async () => {
    if (!user || !settings.billReminders) return;

    try {
      // Fetch accounts
      const { data: accounts } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id);

      if (!accounts) return;

      const newNotifications: Notification[] = [];

      // Get due date reminders for credit cards
      if (settings.billReminders) {
        const reminders = getDueDateReminders(accounts, settings);
        newNotifications.push(...reminders);
      }

      // Get low balance alerts
      if (settings.transactionAlerts) {
        const alerts = getLowBalanceAlerts(accounts);
        newNotifications.push(...alerts);
      }

      // Update notifications
      setNotifications(newNotifications);
      setUnreadCount(newNotifications.filter(n => !n.read).length);

      // Show browser notifications for new critical notifications
      if (newNotifications.length > 0 && Notification.permission === 'granted') {
        newNotifications.slice(0, 3).forEach(notification => {
          if (notification.type === 'reminder' || notification.type === 'alert') {
            showSystemNotification(notification.title, {
              body: notification.message,
              tag: notification.id,
            });
          }
        });
      }
    } catch (error) {
      logger.error('Error checking notifications:', error);
    }
  }, [user, settings]);

  // Check notifications on mount and periodically
  useEffect(() => {
    checkNotifications();
    
    // Check every 5 minutes
    const interval = setInterval(checkNotifications, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [checkNotifications]);

  // Request notification permission on first load
  useEffect(() => {
    if (settings.billReminders && Notification.permission === 'default') {
      requestNotificationPermission();
    }
  }, [settings.billReminders]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return {
    notifications,
    unreadCount,
    settings,
    markAsRead,
    markAllAsRead,
    clearAll,
    refresh: checkNotifications,
  };
}
