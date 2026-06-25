"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationLink,
} from "./notification-actions";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  async function loadNotifications() {
    const data = await getNotifications();
    setNotifications(
      data.notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))
    );
    setUnreadCount(data.unreadCount);
    setLoaded(true);
  }

  // Load the unread count once on mount so the badge is accurate without
  // requiring the dropdown to be opened first.
  useEffect(() => {
    loadNotifications();
  }, []);

  // Close the dropdown when clicking anywhere outside it.
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      await loadNotifications();
    }
  }

  async function handleNotificationClick(notification: Notification) {
    if (!notification.isRead) {
      await markNotificationRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    const link = await getNotificationLink(notification.entityType, notification.entityId);
    setOpen(false);
    if (link) {
      router.push(link);
    }
  }

  async function handleMarkAllRead() {
    await markAllNotificationsRead();
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative text-ink-700 transition hover:text-green-600"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-2 w-80 rounded-lg border border-ink-100 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-green-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-ink-300">No notifications yet.</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleNotificationClick(n)}
                  className={`block w-full border-b border-ink-100 px-4 py-3 text-left transition hover:bg-green-50 ${
                    n.isRead ? "bg-white" : "bg-green-50/50"
                  }`}
                >
                  <p className="text-sm text-ink-700">{n.title}</p>
                  <p className="mt-0.5 text-xs text-ink-300">
                    {new Date(n.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                    })}
                  </p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
