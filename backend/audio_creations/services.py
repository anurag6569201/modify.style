from decimal import Decimal
from .costs import (
    PLATFORM_FEE,
    VOICE_MULTIPLIERS,
    DEFAULT_VOICE_MULTIPLIER
)

def calculate_audio_cost(text_input: str, response_format: str, voice: str) -> Decimal:
    """
    Calculates audio cost based on a multi-component formula.

    Formula: 
    Platform Fee + Base Character Cost + (Base Character Cost * Voice Multiplier) + Format Surcharge
    This ensures that even "free" multiplier voices have a usage-based cost.
    """
    voice_multiplier = VOICE_MULTIPLIERS.get(voice, DEFAULT_VOICE_MULTIPLIER)
    
    # This is the Base Character Cost, which applies to ALL generations.
    base_character_cost = Decimal(len(text_input)) / Decimal('3000.0')

    # This is the Premium Voice Cost, an additional cost for premium voices.
    # For free voices (multiplier=0.0), this will be zero.
    premium_voice_cost = base_character_cost * voice_multiplier

    format_costs = { 'flac': Decimal('0.2'), 'wav': Decimal('0.2') }
    format_surcharge = format_costs.get(response_format, Decimal('0.0'))

    # The new, correct formula adds the base_character_cost to the total.
    # This closes the "free voice" loophole.
    total_cost = PLATFORM_FEE + base_character_cost + premium_voice_cost + format_surcharge
    
    final_cost = round(total_cost, 2)
    
    # The final cost should never be less than the base platform fee.
    return max(final_cost, PLATFORM_FEE)
