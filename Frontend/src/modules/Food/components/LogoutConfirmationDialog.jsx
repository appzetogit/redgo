import React from "react"
import {
  Dialog,
  DialogContent,
} from "@food/components/ui/dialog"
import { Button } from "@food/components/ui/button"
import { LogOut } from "lucide-react"

export default function LogoutConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title = "Log out?",
  description = "Are you sure you want to log out?"
}) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[320px] sm:max-w-[360px] border-none shadow-2xl p-0 overflow-hidden rounded-[32px] bg-white dark:bg-[#1a1a1a]">
        <div className="pt-8 pb-4 px-6">
          <div className="flex justify-center mb-5">
            <div className="w-16 h-16 bg-[#ef4f5f]/10 dark:bg-red-900/20 rounded-2xl flex items-center justify-center rotate-3 scale-110">
              <LogOut className="h-8 w-8 text-[#ef4f5f]" />
            </div>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
              {title}
            </h2>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400 leading-snug px-2">
              {description}
            </p>
          </div>
        </div>

        <div className="px-6 pb-8 pt-2 flex flex-col gap-2.5">
          <Button
            onClick={onConfirm}
            className="w-full h-12 rounded-2xl bg-[#ef4f5f] hover:bg-[#d43d4d] text-white font-bold text-base shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-[0.98]"
          >
            Log out
          </Button>
          <Button
            variant="ghost"
            onClick={onClose}
            className="w-full h-11 rounded-2xl font-bold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all active:scale-[0.98]"
          >
            Keep me logged in
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
