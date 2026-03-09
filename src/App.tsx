/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { 
  MousePointer2, 
  Video, 
  Code, 
  Terminal, 
  Download, 
  Copy, 
  Check, 
  ExternalLink, 
  AlertCircle, 
  Play, 
  Square, 
  Save, 
  FolderOpen,
  Keyboard,
  Zap,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

const PYTHON_CODE = `import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import threading
import time
import json
import os
from pynput import mouse, keyboard
from pynput.mouse import Button, Controller as MouseController
from pynput.keyboard import Key, Controller as KeyboardController, Listener as KeyboardListener
import ctypes

# 适配系统DPI缩放 (Windows 7/10)
try:
    ctypes.windll.shcore.SetProcessDpiAwareness(1)
except Exception:
    try:
        ctypes.windll.user32.SetProcessDPIAware()
    except Exception:
        pass

class MouseMasterApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Windows 鼠标大师 v1.0 - 专业连点与录制回放工具")
        self.root.geometry("800x550")
        self.root.resizable(False, False)

        # 状态变量
        self.is_clicking = False
        self.is_recording = False
        self.is_playing = False
        self.stop_requested = False
        
        # 连点器参数
        self.click_count_done = 0
        self.click_timer = None
        
        # 录制数据
        self.recorded_events = []
        self.record_start_time = 0
        self.mouse_ctrl = MouseController()
        
        # 全局监听器
        self.kb_listener = None
        self.mouse_listener = None
        
        self.setup_ui()
        self.start_global_hotkeys()

    def setup_ui(self):
        # 样式设置
        style = ttk.Style()
        style.configure("TNotebook.Tab", padding=[20, 5], font=('Microsoft YaHei', 10))
        
        # 标签页
        self.notebook = ttk.Notebook(self.root)
        self.notebook.pack(fill='both', expand=True, padx=10, pady=5)

        # --- 连点器标签页 ---
        self.clicker_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.clicker_frame, text=" 鼠标连点器 ")
        self.setup_clicker_ui()

        # --- 录制回放标签页 ---
        self.recorder_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.recorder_frame, text=" 录制回放工具 ")
        self.setup_recorder_ui()

        # 底部固定提示栏
        bottom_bar = tk.Frame(self.root, bg="#f0f0f0", height=30)
        bottom_bar.pack(side='bottom', fill='x')
        tk.Label(bottom_bar, text="全局紧急停止快捷键：Esc | 软件适配 Windows 7/10 | Python 3.8+", 
                 font=('Microsoft YaHei', 9), fg="#666", bg="#f0f0f0").pack(pady=5)

    def setup_clicker_ui(self):
        # 参数设置区域
        settings_lf = ttk.LabelFrame(self.clicker_frame, text="点击设置")
        settings_lf.place(x=20, y=20, width=360, height=280)

        # 点击类型
        tk.Label(settings_lf, text="点击类型:").grid(row=0, column=0, padx=10, pady=15, sticky='w')
        self.click_type_var = tk.StringVar(value="左键单击")
        click_types = ["左键单击", "左键双击", "右键单击", "右键双击", "中键单击"]
        self.click_type_cb = ttk.Combobox(settings_lf, textvariable=self.click_type_var, values=click_types, state="readonly", width=15)
        self.click_type_cb.grid(row=0, column=1, padx=10, pady=15)

        # 点击间隔
        tk.Label(settings_lf, text="点击间隔 (ms):").grid(row=1, column=0, padx=10, pady=15, sticky='w')
        self.interval_var = tk.StringVar(value="100")
        self.interval_entry = ttk.Entry(settings_lf, textvariable=self.interval_var, width=17)
        self.interval_entry.grid(row=1, column=1, padx=10, pady=15)

        # 点击次数
        tk.Label(settings_lf, text="点击次数:").grid(row=2, column=0, padx=10, pady=15, sticky='w')
        self.loop_type_var = tk.IntVar(value=0) # 0: 无限, 1: 固定
        ttk.Radiobutton(settings_lf, text="无限循环", variable=self.loop_type_var, value=0).place(x=100, y=115)
        ttk.Radiobutton(settings_lf, text="固定次数:", variable=self.loop_type_var, value=1).place(x=100, y=145)
        self.count_var = tk.StringVar(value="100")
        self.count_entry = ttk.Entry(settings_lf, textvariable=self.count_var, width=8)
        self.count_entry.place(x=185, y=145)

        # 启动延时
        tk.Label(settings_lf, text="启动延时 (秒):").grid(row=4, column=0, padx=10, pady=15, sticky='w')
        self.delay_var = tk.StringVar(value="3")
        self.delay_entry = ttk.Entry(settings_lf, textvariable=self.delay_var, width=17)
        self.delay_entry.grid(row=4, column=1, padx=10, pady=15)

        # 状态显示区域
        status_lf = ttk.LabelFrame(self.clicker_frame, text="运行状态")
        status_lf.place(x=400, y=20, width=360, height=280)
        
        self.click_status_label = tk.Label(status_lf, text="当前状态: 空闲", font=('Microsoft YaHei', 11))
        self.click_status_label.pack(pady=20)
        
        self.click_info_label = tk.Label(status_lf, text="已点击: 0 次\\n剩余: --", font=('Microsoft YaHei', 10), justify='left')
        self.click_info_label.pack(pady=10)
        
        tk.Label(status_lf, text="快捷键提示:\\n开始连点: F6\\n停止连点: F7", fg="#555", justify='left').pack(pady=10)

        # 操作按钮
        self.btn_start_click = tk.Button(self.clicker_frame, text="开始连点 (F6)", bg="#4CAF50", fg="white", 
                                       font=('Microsoft YaHei', 12, 'bold'), command=self.start_clicking_thread)
        self.btn_start_click.place(x=150, y=330, width=200, height=50)
        
        self.btn_stop_click = tk.Button(self.clicker_frame, text="停止连点 (F7)", bg="#f44336", fg="white", 
                                      font=('Microsoft YaHei', 12, 'bold'), command=self.stop_clicking)
        self.btn_stop_click.place(x=450, y=330, width=200, height=50)

    def setup_recorder_ui(self):
        # 录制控制
        record_lf = ttk.LabelFrame(self.recorder_frame, text="录制控制")
        record_lf.place(x=20, y=10, width=360, height=200)
        
        self.btn_record = tk.Button(record_lf, text="开始录制 (F8)", bg="#4CAF50", fg="white", command=self.start_recording_thread)
        self.btn_record.place(x=20, y=20, width=140, height=40)
        
        self.btn_stop_record = tk.Button(record_lf, text="停止录制 (F9)", bg="#f44336", fg="white", command=self.stop_recording)
        self.btn_stop_record.place(x=180, y=20, width=140, height=40)
        
        self.record_info_label = tk.Label(record_lf, text="状态: 未录制\\n时长: 0.0s\\n事件数: 0", justify='left')
        self.record_info_label.place(x=20, y=80)
        
        # 脚本管理
        script_lf = ttk.LabelFrame(self.recorder_frame, text="脚本管理")
        script_lf.place(x=20, y=220, width=360, height=150)
        
        ttk.Button(script_lf, text="保存脚本", command=self.save_script).place(x=20, y=30, width=140, height=35)
        ttk.Button(script_lf, text="加载脚本", command=self.load_script).place(x=180, y=30, width=140, height=35)
        self.script_path_label = tk.Label(script_lf, text="当前脚本: 无", wraplength=320, justify='left', font=('Microsoft YaHei', 8))
        self.script_path_label.place(x=20, y=80)

        # 回放控制
        play_lf = ttk.LabelFrame(self.recorder_frame, text="回放设置与控制")
        play_lf.place(x=400, y=10, width=360, height=360)
        
        tk.Label(play_lf, text="回放次数:").place(x=20, y=20)
        self.play_loop_var = tk.IntVar(value=0)
        ttk.Radiobutton(play_lf, text="无限", variable=self.play_loop_var, value=0).place(x=90, y=20)
        ttk.Radiobutton(play_lf, text="固定:", variable=self.play_loop_var, value=1).place(x=150, y=20)
        self.play_count_var = tk.StringVar(value="1")
        ttk.Entry(play_lf, textvariable=self.play_count_var, width=5).place(x=210, y=20)
        
        tk.Label(play_lf, text="回放速度:").place(x=20, y=60)
        self.play_speed_var = tk.DoubleVar(value=1.0)
        self.speed_scale = ttk.Scale(play_lf, from_=0.5, to=5.0, variable=self.play_speed_var, orient='horizontal')
        self.speed_scale.place(x=90, y=60, width=150)
        self.speed_label = tk.Label(play_lf, text="1.0x")
        self.speed_label.place(x=250, y=60)
        self.play_speed_var.trace_add("write", lambda *args: self.speed_label.config(text=f"{self.play_speed_var.get():.1f}x"))

        self.strict_time_var = tk.BooleanVar(value=True)
        ttk.Checkbutton(play_lf, text="严格遵循录制时间间隔", variable=self.strict_time_var).place(x=20, y=100)

        self.btn_play = tk.Button(play_lf, text="开始回放 (F10)", bg="#2196F3", fg="white", font=('Microsoft YaHei', 10, 'bold'), command=self.start_playback_thread)
        self.btn_play.place(x=20, y=150, width=320, height=45)
        
        self.btn_stop_play = tk.Button(play_lf, text="停止回放 (F11)", bg="#f44336", fg="white", font=('Microsoft YaHei', 10, 'bold'), command=self.stop_playback)
        self.btn_stop_play.place(x=20, y=210, width=320, height=45)
        
        self.play_status_label = tk.Label(play_lf, text="回放状态: 空闲\\n当前进度: 0%\\n已完成次数: 0", justify='left', font=('Microsoft YaHei', 10))
        self.play_status_label.place(x=20, y=270)

    # --- 核心逻辑 ---

    def start_global_hotkeys(self):
        def on_press(key):
            try:
                if key == keyboard.Key.esc:
                    self.emergency_stop()
                elif key == keyboard.Key.f6:
                    self.start_clicking_thread()
                elif key == keyboard.Key.f7:
                    self.stop_clicking()
                elif key == keyboard.Key.f8:
                    self.start_recording_thread()
                elif key == keyboard.Key.f9:
                    self.stop_recording()
                elif key == keyboard.Key.f10:
                    self.start_playback_thread()
                elif key == keyboard.Key.f11:
                    self.stop_playback()
            except Exception:
                pass

        self.kb_listener = keyboard.Listener(on_press=on_press)
        self.kb_listener.start()

    def emergency_stop(self):
        self.stop_requested = True
        self.is_clicking = False
        self.is_recording = False
        self.is_playing = False
        
        # 恢复UI状态
        self.root.after(0, self.reset_ui_states)
        print("紧急停止触发！")

    def reset_ui_states(self):
        self.click_status_label.config(text="当前状态: 已紧急停止", fg="red")
        self.play_status_label.config(text="回放状态: 已紧急停止", fg="red")
        self.record_info_label.config(text="状态: 已紧急停止", fg="red")
        self.unlock_inputs()

    def lock_inputs(self):
        # 锁定连点器输入
        self.click_type_cb.config(state="disabled")
        self.interval_entry.config(state="disabled")
        self.count_entry.config(state="disabled")
        self.delay_entry.config(state="disabled")
        # 锁定回放输入
        self.btn_record.config(state="disabled")
        self.btn_play.config(state="disabled")

    def unlock_inputs(self):
        self.click_type_cb.config(state="readonly")
        self.interval_entry.config(state="normal")
        self.count_entry.config(state="normal")
        self.delay_entry.config(state="normal")
        self.btn_record.config(state="normal")
        self.btn_play.config(state="normal")

    # --- 连点器逻辑 ---

    def validate_clicker_inputs(self):
        try:
            interval = int(self.interval_var.get())
            if not (10 <= interval <= 999999): raise ValueError
            
            delay = int(self.delay_var.get())
            if delay < 0: raise ValueError
            
            if self.loop_type_var.get() == 1:
                count = int(self.count_var.get())
                if count <= 0: raise ValueError
            return True
        except ValueError:
            messagebox.showerror("输入错误", "请输入有效的数字参数！\\n间隔范围: 10-999999ms\\n延时 >= 0s\\n次数 > 0")
            return False

    def start_clicking_thread(self):
        if self.is_clicking: return
        if not self.validate_clicker_inputs(): return
        
        self.is_clicking = True
        self.stop_requested = False
        self.lock_inputs()
        threading.Thread(target=self.clicking_loop, daemon=True).start()

    def clicking_loop(self):
        delay = int(self.delay_var.get())
        for i in range(delay, 0, -1):
            if not self.is_clicking: break
            self.root.after(0, lambda x=i: self.click_status_label.config(text=f"等待启动: {x}s", fg="orange"))
            time.sleep(1)
        
        if not self.is_clicking: 
            self.root.after(0, self.unlock_inputs)
            return

        self.root.after(0, lambda: self.click_status_label.config(text="正在连点...", fg="green"))
        
        interval = int(self.interval_var.get()) / 1000.0
        click_type = self.click_type_var.get()
        loop_type = self.loop_type_var.get()
        target_count = int(self.count_var.get()) if loop_type == 1 else float('inf')
        
        self.click_count_done = 0
        
        button = Button.left
        if "右键" in click_type: button = Button.right
        elif "中键" in click_type: button = Button.middle
        
        is_double = "双击" in click_type

        while self.is_clicking and self.click_count_done < target_count:
            if is_double:
                self.mouse_ctrl.click(button, 2)
            else:
                self.mouse_ctrl.click(button, 1)
            
            self.click_count_done += 1
            
            # 更新UI
            rem = target_count - self.click_count_done if loop_type == 1 else "无限"
            self.root.after(0, lambda c=self.click_count_done, r=rem: self.click_info_label.config(text=f"已点击: {c} 次\\n剩余: {r}"))
            
            time.sleep(interval)
        
        self.is_clicking = False
        self.root.after(0, lambda: self.click_status_label.config(text="当前状态: 已停止", fg="black"))
        self.root.after(0, self.unlock_inputs)

    def stop_clicking(self):
        self.is_clicking = False

    # --- 录制逻辑 ---

    def start_recording_thread(self):
        if self.is_recording or self.is_playing: return
        self.is_recording = True
        self.recorded_events = []
        self.lock_inputs()
        threading.Thread(target=self.recording_process, daemon=True).start()

    def recording_process(self):
        # 3秒倒计时
        for i in range(3, 0, -1):
            if not self.is_recording: break
            self.root.after(0, lambda x=i: self.record_info_label.config(text=f"准备录制: {x}s"))
            time.sleep(1)
        
        if not self.is_recording:
            self.root.after(0, self.unlock_inputs)
            return

        self.record_start_time = time.time()
        self.root.after(0, lambda: self.record_info_label.config(text="正在录制...", fg="red"))
        
        def on_click(x, y, button, pressed):
            if not self.is_recording: return False
            event = {
                'type': 'click',
                'time': time.time() - self.record_start_time,
                'x': x, 'y': y,
                'button': str(button),
                'pressed': pressed
            }
            self.recorded_events.append(event)
            self.update_record_ui()

        def on_scroll(x, y, dx, dy):
            if not self.is_recording: return False
            event = {
                'type': 'scroll',
                'time': time.time() - self.record_start_time,
                'x': x, 'y': y,
                'dx': dx, 'dy': dy
            }
            self.recorded_events.append(event)
            self.update_record_ui()

        def on_move(x, y):
            if not self.is_recording: return False
            # 轨迹记录做一定频率限制，避免数据过大
            if len(self.recorded_events) > 0 and self.recorded_events[-1]['type'] == 'move':
                if time.time() - self.record_start_time - self.recorded_events[-1]['time'] < 0.01:
                    return
            event = {
                'type': 'move',
                'time': time.time() - self.record_start_time,
                'x': x, 'y': y
            }
            self.recorded_events.append(event)
            self.update_record_ui()

        with mouse.Listener(on_move=on_move, on_click=on_click, on_scroll=on_scroll) as listener:
            self.mouse_listener = listener
            listener.join()
        
        self.root.after(0, self.unlock_inputs)

    def update_record_ui(self):
        duration = time.time() - self.record_start_time
        count = len(self.recorded_events)
        self.root.after(0, lambda d=duration, c=count: self.record_info_label.config(text=f"状态: 录制中\\n时长: {d:.1f}s\\n事件数: {c}"))

    def stop_recording(self):
        self.is_recording = False
        if self.mouse_listener:
            self.mouse_listener.stop()
        self.root.after(0, lambda: self.record_info_label.config(text=f"状态: 已停止\\n总事件: {len(self.recorded_events)}", fg="black"))

    def save_script(self):
        if not self.recorded_events:
            messagebox.showwarning("提示", "没有可保存的录制数据！")
            return
        path = filedialog.asksaveasfilename(defaultextension=".json", filetypes=[("JSON Files", "*.json")])
        if path:
            try:
                with open(path, 'w') as f:
                    json.dump(self.recorded_events, f)
                self.script_path_label.config(text=f"当前脚本: {os.path.basename(path)}")
                messagebox.showinfo("成功", "脚本保存成功！")
            except Exception as e:
                messagebox.showerror("错误", f"保存失败: {e}")

    def load_script(self):
        path = filedialog.askopenfilename(filetypes=[("JSON Files", "*.json")])
        if path:
            try:
                with open(path, 'r') as f:
                    self.recorded_events = json.load(f)
                self.script_path_label.config(text=f"当前脚本: {os.path.basename(path)}")
                messagebox.showinfo("成功", f"成功加载 {len(self.recorded_events)} 个事件")
            except Exception as e:
                messagebox.showerror("错误", f"加载失败: {e}")

    # --- 回放逻辑 ---

    def start_playback_thread(self):
        if not self.recorded_events:
            messagebox.showwarning("提示", "请先录制或加载脚本！")
            return
        if self.is_playing or self.is_recording: return
        
        self.is_playing = True
        self.stop_requested = False
        self.lock_inputs()
        threading.Thread(target=self.playback_process, daemon=True).start()

    def playback_process(self):
        loop_type = self.play_loop_var.get()
        target_count = int(self.play_count_var.get()) if loop_type == 1 else float('inf')
        speed = self.play_speed_var.get()
        strict = self.strict_time_var.get()
        
        done_count = 0
        while self.is_playing and done_count < target_count:
            self.root.after(0, lambda c=done_count: self.play_status_label.config(text=f"回放状态: 正在回放\\n当前进度: 0%\\n已完成次数: {c}", fg="blue"))
            
            last_time = 0
            total_events = len(self.recorded_events)
            
            for i, event in enumerate(self.recorded_events):
                if not self.is_playing: break
                
                # 时间间隔处理
                if strict:
                    wait_time = (event['time'] - last_time) / speed
                    if wait_time > 0:
                        time.sleep(wait_time)
                
                # 执行操作
                try:
                    if event['type'] == 'move':
                        self.mouse_ctrl.position = (event['x'], event['y'])
                    elif event['type'] == 'click':
                        self.mouse_ctrl.position = (event['x'], event['y'])
                        btn = Button.left
                        if 'right' in event['button']: btn = Button.right
                        elif 'middle' in event['button']: btn = Button.middle
                        
                        if event['pressed']:
                            self.mouse_ctrl.press(btn)
                        else:
                            self.mouse_ctrl.release(btn)
                    elif event['type'] == 'scroll':
                        self.mouse_ctrl.position = (event['x'], event['y'])
                        self.mouse_ctrl.scroll(event['dx'], event['dy'])
                except Exception:
                    pass
                
                last_time = event['time']
                
                # 更新进度
                if i % 10 == 0:
                    progress = int((i+1) / total_events * 100)
                    self.root.after(0, lambda p=progress, c=done_count: self.play_status_label.config(text=f"回放状态: 正在回放\\n当前进度: {p}%\\n已完成次数: {c}"))

            done_count += 1
            if not self.is_playing: break
            time.sleep(0.5) # 循环间隔

        self.is_playing = False
        self.root.after(0, lambda: self.play_status_label.config(text="回放状态: 已停止", fg="black"))
        self.root.after(0, self.unlock_inputs)

    def stop_playback(self):
        self.is_playing = False

if __name__ == "__main__":
    root = tk.Tk()
    app = MouseMasterApp(root)
    
    # 捕获窗口关闭
    def on_closing():
        app.emergency_stop()
        root.destroy()
        os._exit(0)
        
    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()`;

export default function App() {
  const [activeTab, setActiveTab] = useState<'overview' | 'code' | 'guide'>('overview');
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(PYTHON_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <MousePointer2 className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Windows Mouse Master</h1>
            </div>
            <nav className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              <TabButton 
                active={activeTab === 'overview'} 
                onClick={() => setActiveTab('overview')}
                icon={<Zap className="w-4 h-4" />}
                label="概览"
              />
              <TabButton 
                active={activeTab === 'code'} 
                onClick={() => setActiveTab('code')}
                icon={<Code className="w-4 h-4" />}
                label="源代码"
              />
              <TabButton 
                active={activeTab === 'guide'} 
                onClick={() => setActiveTab('guide')}
                icon={<Terminal className="w-4 h-4" />}
                label="构建指南"
              />
            </nav>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Hero Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-6">
                  <h2 className="text-4xl font-extrabold text-slate-900 leading-tight">
                    专业级 Windows <br />
                    <span className="text-indigo-600">鼠标自动化工具</span>
                  </h2>
                  <p className="text-lg text-slate-600 max-w-lg">
                    基于 Python 和 Tkinter 构建，集成了高频连点、轨迹录制、脚本回放等核心功能。
                    完美兼容 Windows 7/10，支持全局热键与紧急停止。
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <button 
                      onClick={() => setActiveTab('code')}
                      className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
                    >
                      <Download className="w-5 h-5" />
                      获取源代码
                    </button>
                    <button 
                      onClick={() => setActiveTab('guide')}
                      className="px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-semibold hover:bg-slate-50 transition-colors flex items-center gap-2"
                    >
                      <Terminal className="w-5 h-5" />
                      查看构建指南
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute -inset-4 bg-indigo-100 rounded-3xl blur-2xl opacity-50"></div>
                  <div className="relative bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden aspect-[4/3] flex flex-col">
                    <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-400"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                        <div className="w-3 h-3 rounded-full bg-green-400"></div>
                      </div>
                      <span className="text-xs font-medium text-slate-500">Windows 鼠标大师 v1.0</span>
                    </div>
                    <div className="flex-1 p-6 grid grid-cols-2 gap-6">
                      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                        <div className="flex items-center gap-2 mb-4">
                          <Zap className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-bold">连点器</span>
                        </div>
                        <div className="space-y-3">
                          <div className="h-8 bg-white border border-slate-200 rounded-md"></div>
                          <div className="h-8 bg-white border border-slate-200 rounded-md"></div>
                          <div className="h-10 bg-green-500 rounded-md"></div>
                        </div>
                      </div>
                      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/50">
                        <div className="flex items-center gap-2 mb-4">
                          <Video className="w-4 h-4 text-indigo-600" />
                          <span className="text-sm font-bold">录制回放</span>
                        </div>
                        <div className="space-y-3">
                          <div className="flex gap-2">
                            <div className="h-8 flex-1 bg-white border border-slate-200 rounded-md"></div>
                            <div className="h-8 flex-1 bg-white border border-slate-200 rounded-md"></div>
                          </div>
                          <div className="h-16 bg-white border border-slate-200 rounded-md"></div>
                          <div className="h-10 bg-indigo-500 rounded-md"></div>
                        </div>
                      </div>
                    </div>
                    <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 text-[10px] text-slate-400 text-center">
                      全局紧急停止快捷键：Esc
                    </div>
                  </div>
                </div>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FeatureCard 
                  icon={<Zap className="w-6 h-6 text-amber-500" />}
                  title="极速连点"
                  description="支持左/中/右键，单击/双击。最小间隔 10ms，支持无限循环或固定次数。"
                />
                <FeatureCard 
                  icon={<Video className="w-6 h-6 text-indigo-500" />}
                  title="轨迹录制"
                  description="完整记录鼠标移动、点击、滚动及精确时间戳。支持导出/导入 JSON 脚本。"
                />
                <FeatureCard 
                  icon={<ShieldCheck className="w-6 h-6 text-emerald-500" />}
                  title="安全稳定"
                  description="全局 Esc 紧急停止，输入合法性校验，多线程运行不卡顿，低资源占用。"
                />
              </div>
            </motion.div>
          )}

          {activeTab === 'code' && (
            <motion.div
              key="code"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">mouse_tool.py</h3>
                  <p className="text-sm text-slate-500">完整的 Python 源代码</p>
                </div>
                <button 
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-all active:scale-95"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copied ? '已复制' : '复制代码'}
                </button>
              </div>
              <div className="rounded-xl overflow-hidden border border-slate-200 shadow-xl max-h-[600px] overflow-y-auto">
                <SyntaxHighlighter 
                  language="python" 
                  style={vscDarkPlus}
                  customStyle={{ margin: 0, padding: '24px', fontSize: '14px', lineHeight: '1.6' }}
                  showLineNumbers
                >
                  {PYTHON_CODE}
                </SyntaxHighlighter>
              </div>
            </motion.div>
          )}

          {activeTab === 'guide' && (
            <motion.div
              key="guide"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto space-y-8"
            >
              <section className="space-y-4">
                <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Terminal className="w-6 h-6 text-indigo-600" />
                  Python 3.8 安装与配置
                </h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-sm">
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs">1</span>
                      下载安装包
                    </h4>
                    <p className="text-slate-600 text-sm pl-8">
                      访问 <a href="https://www.python.org/downloads/windows/" target="_blank" className="text-indigo-600 hover:underline inline-flex items-center gap-1">Python 官网 <ExternalLink className="w-3 h-3" /></a>，下载 <b>Python 3.8.10</b> (Windows x86-64 executable installer)。
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-xs">!</span>
                      关键步骤：勾选 Add to PATH
                    </h4>
                    <p className="text-slate-600 text-sm pl-8">
                      运行安装程序时，<b>务必勾选底部</b>的 <span className="font-bold text-slate-900">"Add Python 3.8 to PATH"</span>。这样你才能在 CMD 中直接运行 python 命令。
                    </p>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs">2</span>
                      使用 CMD 验证安装
                    </h4>
                    <p className="text-slate-600 text-sm pl-8">
                      按下 <kbd className="bg-slate-100 px-1 rounded border border-slate-300">Win + R</kbd>，输入 <span className="font-mono bg-slate-100 px-1">cmd</span> 并回车，输入以下命令：
                    </p>
                    <div className="pl-8">
                      <code className="block bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono">
                        python --version
                      </code>
                      <p className="text-xs text-slate-400 mt-2">预期输出：Python 3.8.x</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-800 flex items-center gap-2">
                      <span className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center text-xs">3</span>
                      安装必要依赖
                    </h4>
                    <p className="text-slate-600 text-sm pl-8">
                      在同一个 CMD 窗口中，运行以下命令安装鼠标控制库：
                    </p>
                    <div className="pl-8">
                      <code className="block bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono">
                        pip install pynput
                      </code>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <Save className="w-6 h-6 text-indigo-600" />
                  打包为单文件 EXE
                </h3>
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                  <p className="text-slate-600 text-sm">
                    如果你想把代码发给别人直接运行，可以使用 PyInstaller 打包：
                  </p>
                  <div className="space-y-3">
                    <code className="block bg-slate-900 text-slate-100 p-4 rounded-lg text-sm font-mono">
                      pip install pyinstaller<br />
                      pyinstaller --noconsole --onefile --name "鼠标大师" mouse_tool.py
                    </code>
                  </div>
                </div>
              </section>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="mt-auto py-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-slate-400 text-sm">
            © 2026 Windows Mouse Master. Created for professional automation.
          </p>
        </div>
      </footer>
    </div>
  );
}

function TabButton({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all
        ${active 
          ? 'bg-white text-indigo-600 shadow-sm' 
          : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'}
      `}
    >
      {icon}
      {label}
    </button>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white border border-slate-200 p-6 rounded-2xl hover:shadow-lg transition-shadow">
      <div className="mb-4">{icon}</div>
      <h4 className="text-lg font-bold text-slate-900 mb-2">{title}</h4>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

