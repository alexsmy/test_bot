import os
import logging
import json
from telegram import Update, WebAppInfo, KeyboardButton, ReplyKeyboardMarkup
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

# --- Настройка логирования ---
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s", level=logging.INFO
)
logger = logging.getLogger(__name__)

# --- Получение переменных окружения ---
BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN")
WEB_APP_URL = os.environ.get("WEB_APP_URL")

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Отправляет приветственное сообщение и устанавливает постоянную кнопку 
    для запуска Mini App. Добавлена обработка ошибок.
    """
    logger.info(f"Command /start received from user {update.effective_user.id}")
    try:
        # Проверяем, что URL веб-приложения не пустой и корректен
        if not WEB_APP_URL or not WEB_APP_URL.startswith("https://"):
            logger.error(f"WEB_APP_URL is not set or invalid: {WEB_APP_URL}")
            await update.message.reply_text(
                "🚫 **Ошибка конфигурации бота.**\n\n"
                "URL веб-приложения не настроен или имеет неверный формат. "
                "Он должен начинаться с `https://`."
            )
            return

        # Создаем кнопку, которая будет находиться внизу экрана
        keyboard = [
            [KeyboardButton("🚀 Тест скорости", web_app=WebAppInfo(url=WEB_APP_URL))]
        ]
        # one_time_keyboard=False делает клавиатуру постоянной
        reply_markup = ReplyKeyboardMarkup(keyboard, resize_keyboard=True, one_time_keyboard=False)

        await update.message.reply_text(
            "👋 **Добро пожаловать в Pro Speed Test!**\n\n"
            "Этот бот поможет вам измерить реальную скорость вашего интернет-соединения.\n\n"
            "Для начала просто нажмите кнопку «🚀 Тест скорости» внизу экрана.",
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        logger.info(f"Welcome message sent to user {update.effective_user.id}")

    except Exception as e:
        # Логируем полную ошибку для отладки
        logger.error(f"An error occurred in start handler: {e}", exc_info=True)
        # Отправляем пользователю сообщение об ошибке
        await update.message.reply_text(
            "😔 Произошла внутренняя ошибка при обработке вашей команды. "
            "Попробуйте еще раз позже или свяжитесь с администратором."
        )

async def web_app_data(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Обрабатывает данные, полученные от Web App, и отправляет результаты пользователю.
    """
    data = json.loads(update.message.web_app_data.data)
    
    message_text = (
        "✅ **Ваш тест скорости завершен!**\n\n"
        f"**Пинг (задержка):**\n"
        f"  `{data.get('ping', 'N/A')}`\n\n"
        f"**Скорость загрузки (Download):**\n"
        f"  `{data.get('download', 'N/A')}`\n\n"
        f"**Скорость отправки (Upload):**\n"
        f"  `{data.get('upload', 'N/A')}`"
    )
    
    await update.message.reply_text(
        text=message_text,
        parse_mode='Markdown'
    )

def main() -> None:
    """Основная функция для запуска бота."""
    application = Application.builder().token(BOT_TOKEN).build()
    
    application.add_handler(CommandHandler("start", start))
    application.add_handler(MessageHandler(filters.StatusUpdate.WEB_APP_DATA, web_app_data))
    
    print("Telegram bot is running...")
    application.run_polling()

if __name__ == "__main__":
    if not BOT_TOKEN:
        print("ERROR: Missing environment variable TELEGRAM_BOT_TOKEN.")
    else:
        main()
